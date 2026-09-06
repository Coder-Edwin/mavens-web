import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  // GET /api/v1/articles?limit=3 — PUBLIC, published posts only
  @Get()
  findPublished(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    return this.articlesService.findPublished(Number.isFinite(parsed) ? parsed : undefined);
  }

  // GET /api/v1/articles/admin — admin only, all posts incl. drafts.
  // Declared before :slug so "admin" isn't captured as a slug.
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findAllForAdmin() {
    return this.articlesService.findAllForAdmin();
  }

  // GET /api/v1/articles/:slug — PUBLIC, published post by permalink
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.articlesService.findPublishedBySlug(slug);
  }

  // POST /api/v1/articles — admin only
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateArticleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.articlesService.create(dto, user);
  }

  // PATCH /api/v1/articles/:id — admin only
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.articlesService.update(id, dto);
  }

  // DELETE /api/v1/articles/:id — admin only
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }
}
