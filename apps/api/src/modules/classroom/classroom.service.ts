import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Chess } from 'chess.js';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClassroomRoomDto, LoadClassroomPositionDto } from './dto/classroom.dto';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Unambiguous alphabet (no 0/O, 1/I) — codes are read aloud/typed by hand to
// join a room, same reasoning as an invite code.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface LibraryEntry {
  id: string;
  label: string;
  pgn: string;
}

function generateCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return out;
}

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'P2002';
}

/// Replays PGN text (chess.js handles a [FEN]/[SetUp "1"] header itself, so
/// this also covers "just a position, no moves").
function fenFromPgn(pgn: string): string {
  const chess = new Chess();
  if (pgn && pgn.trim()) chess.loadPgn(pgn);
  return chess.fen();
}

/// Wraps a bare FEN as headers-only PGN so the room only ever has to persist
/// one field (`pgn`) to fully describe "current position, however it got
/// there" — loading it back is the same `loadPgn` path either way.
function pgnFromFen(fen: string): string {
  const chess = new Chess(fen); // throws on an invalid FEN
  return chess.pgn();
}

@Injectable()
export class ClassroomService {
  constructor(private readonly prisma: PrismaService) {}

  private library(room: { library: unknown }): LibraryEntry[] {
    return Array.isArray(room.library) ? (room.library as LibraryEntry[]) : [];
  }

  async create(hostUserId: string, dto: CreateClassroomRoomDto) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.classroomRoom.create({
          data: {
            code: generateCode(),
            title: dto.title?.trim() || null,
            hostUserId,
            fen: START_FEN,
            pgn: '',
            library: []
          }
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Code collision — vanishingly rare with a 33^6 space, just retry.
      }
    }
    throw new BadRequestException('Could not allocate a room code — try again');
  }

  async getByCode(code: string) {
    const room = await this.prisma.classroomRoom.findUnique({
      where: { code: code.trim().toUpperCase() }
    });
    if (!room) throw new NotFoundException('No classroom with that code');
    return room;
  }

  async get(id: string) {
    const room = await this.prisma.classroomRoom.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Classroom not found');
    return room;
  }

  async close(id: string, userId: string) {
    const room = await this.get(id);
    if (room.hostUserId !== userId) throw new ForbiddenException('Only the host can close this room');
    if (room.status === 'CLOSED') return room;
    return this.prisma.classroomRoom.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() }
    });
  }

  private assertOpen(room: { status: string }) {
    if (room.status !== 'OPEN') throw new BadRequestException('This classroom has been closed');
  }

  /// Any participant may move — this is a shared whiteboard, not a
  /// turn-enforced 1v1 game. chess.js still enforces whose turn it is and
  /// what's legal on the *loaded* position.
  async applyMove(id: string, move: { from: string; to: string; promotion?: string }) {
    const room = await this.get(id);
    this.assertOpen(room);

    const chess = new Chess();
    if (room.pgn && room.pgn.trim()) chess.loadPgn(room.pgn);

    let played;
    try {
      played = chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
    } catch {
      throw new BadRequestException('Illegal move');
    }

    const updated = await this.prisma.classroomRoom.update({
      where: { id },
      data: { fen: chess.fen(), pgn: chess.pgn() }
    });
    return { room: updated, move: { san: played.san, from: played.from, to: played.to } };
  }

  /// Loads a new current position from a pasted PGN or FEN and files it into
  /// the room's library tray ("load several games at once").
  async loadPosition(id: string, dto: LoadClassroomPositionDto) {
    const room = await this.get(id);
    this.assertOpen(room);
    if (!dto.pgn && !dto.fen) throw new BadRequestException('Provide a pgn or a fen');

    let pgn: string;
    let fen: string;
    try {
      pgn = dto.pgn ?? pgnFromFen(dto.fen!);
      fen = fenFromPgn(pgn); // also validates a pasted PGN
    } catch {
      throw new BadRequestException('That is neither a valid PGN nor a valid FEN');
    }

    const entry: LibraryEntry = {
      id: crypto.randomUUID(),
      label: dto.label?.trim() || `Game ${this.library(room).length + 1}`,
      pgn
    };
    const library = [...this.library(room), entry];

    const updated = await this.prisma.classroomRoom.update({
      where: { id },
      data: { fen, pgn, library: library as unknown as Prisma.InputJsonValue }
    });
    return { room: updated, entry };
  }

  /// Switches the current position to an already-loaded library entry.
  async selectFromLibrary(id: string, entryId: string) {
    const room = await this.get(id);
    this.assertOpen(room);
    const entry = this.library(room).find((e) => e.id === entryId);
    if (!entry) throw new NotFoundException('That game is not in this room’s library');

    return this.prisma.classroomRoom.update({
      where: { id },
      data: { fen: fenFromPgn(entry.pgn), pgn: entry.pgn }
    });
  }

  async removeFromLibrary(id: string, entryId: string) {
    const room = await this.get(id);
    const library = this.library(room).filter((e) => e.id !== entryId);
    return this.prisma.classroomRoom.update({
      where: { id },
      data: { library: library as unknown as Prisma.InputJsonValue }
    });
  }

  async reset(id: string) {
    const room = await this.get(id);
    this.assertOpen(room);
    return this.prisma.classroomRoom.update({
      where: { id },
      data: { fen: START_FEN, pgn: '' }
    });
  }
}
