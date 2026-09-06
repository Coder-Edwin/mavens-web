import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { leadsApi, type LeadInput } from '@/lib/leads';
import { ApiError } from '@/lib/api-client';
import '@/styles/marketing.css';

const EMPTY = { parentName: '', email: '', phone: '', childName: '', childAge: '', message: '' };

/**
 * Public "join the club" interest form. Submissions land in the admin
 * leads inbox (/app/leads); a coach follows up from there.
 */
export function JoinPage() {
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setState('submitting');
    try {
      const payload: LeadInput = {
        parentName: form.parentName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        childName: form.childName.trim() || undefined,
        childAge: form.childAge.trim() ? Number(form.childAge) : undefined,
        message: form.message.trim() || undefined
      };
      await leadsApi.submit(payload);
      setState('done');
    } catch (err) {
      setState('idle');
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong sending your details. Please try again or call us.'
      );
    }
  }

  return (
    <div className="mk">
      <MarketingHeader />

      <section className="mk-page">
        <div className="mk-container mk-form-wrap">
          <p className="mk-eyebrow">Join the club</p>
          <h1 className="mk-h2" style={{ fontSize: 32 }}>
            Register your interest
          </h1>

          {state === 'done' ? (
            <div className="mk-form-success">
              <h3>Thanks — we’ve got your details</h3>
              <p className="mk-lead" style={{ margin: '0 auto' }}>
                A Mavens coach will be in touch soon. If it’s urgent, call{' '}
                <a href="tel:+254702101676">+254&nbsp;702&nbsp;101&nbsp;676</a>.
              </p>
              <div style={{ marginTop: 20 }}>
                <Link to="/" className="btn btn-ghost btn-sm">
                  ← Back to site
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="mk-lead">
                Tell us a little about the player and how to reach you. Fields marked * are required.
              </p>

              <form className="mk-form" onSubmit={handleSubmit} noValidate aria-label="Register your interest">
                {error && <div className="mk-form-error">{error}</div>}

                <div className="mk-field">
                  <label htmlFor="join-parent">Your name *</label>
                  <input
                    id="join-parent"
                    value={form.parentName}
                    onChange={set('parentName')}
                    required
                    maxLength={120}
                  />
                </div>

                <div className="row2">
                  <div className="mk-field">
                    <label htmlFor="join-email">Email *</label>
                    <input
                      id="join-email"
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      required
                    />
                  </div>
                  <div className="mk-field">
                    <label htmlFor="join-phone">Phone *</label>
                    <input
                      id="join-phone"
                      type="tel"
                      value={form.phone}
                      onChange={set('phone')}
                      required
                      placeholder="07XX XXX XXX"
                    />
                  </div>
                </div>

                <div className="row2">
                  <div className="mk-field">
                    <label htmlFor="join-child">Child’s name</label>
                    <input id="join-child" value={form.childName} onChange={set('childName')} maxLength={120} />
                  </div>
                  <div className="mk-field">
                    <label htmlFor="join-age">Child’s age</label>
                    <input
                      id="join-age"
                      type="number"
                      min={3}
                      max={21}
                      value={form.childAge}
                      onChange={set('childAge')}
                    />
                  </div>
                </div>

                <div className="mk-field">
                  <label htmlFor="join-message">Anything else?</label>
                  <textarea
                    id="join-message"
                    value={form.message}
                    onChange={set('message')}
                    maxLength={2000}
                    placeholder="Preferred days, experience level, questions…"
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button type="submit" className="btn btn-gold" disabled={state === 'submitting'}>
                    {state === 'submitting' ? 'Sending…' : 'Send my details'}
                  </button>
                  <Link to="/" className="mk-back">
                    ← Back to site
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
