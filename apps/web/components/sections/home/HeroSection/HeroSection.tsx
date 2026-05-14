'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { homeContent } from '@/content/home.content';

const { hero } = homeContent;

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: EASE, delay },
  };
}

export function HeroSection() {
  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center pt-24 pb-16 px-4 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-radial from-brand-amber/8 via-brand-amber/3 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-brand-amber/4 rounded-full blur-[100px]" />
        <div className="absolute top-1/4 right-1/4 w-[200px] h-[200px] bg-status-info/4 rounded-full blur-[80px]" />
      </div>

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(248,248,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(248,248,255,1) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto text-center">
        {/* Badge */}
        <motion.div {...fadeUp(0)} className="mb-8 flex justify-center">
          <Badge variant="ai" size="lg" dot>
            <Sparkles size={12} />
            {hero.label}
          </Badge>
        </motion.div>

        {/* Headline */}
        <motion.h1
          {...fadeUp(0.1)}
          className="text-[clamp(2.75rem,8vw,6rem)] font-bold leading-[1.05] tracking-tight mb-6"
        >
          {hero.headline.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
          <span className="block text-gradient-amber">{hero.accentWord}</span>
        </motion.h1>

        {/* Subline */}
        <motion.p
          {...fadeUp(0.2)}
          className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed mb-10"
        >
          {hero.subline}
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...fadeUp(0.3)}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6"
        >
          <Button variant="primary" size="xl" asChild>
            <Link href={hero.ctaPrimary.href} className="group">
              {hero.ctaPrimary.label}
              <ArrowRight
                size={16}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
          </Button>
          <Button variant="ghost" size="xl" asChild>
            <Link href={hero.ctaSecondary.href}>{hero.ctaSecondary.label}</Link>
          </Button>
        </motion.div>

        {/* Social proof */}
        <motion.p {...fadeUp(0.4)} className="text-sm text-text-muted">
          {hero.socialProof}
        </motion.p>
      </div>

      {/* AI Activity Demo */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
        className="relative z-10 mt-16 w-full max-w-3xl mx-auto px-4"
      >
        <AiActivityPreview />
      </motion.div>
    </section>
  );
}

function AiActivityPreview() {
  const events = [
    {
      type: 'Classificação',
      text: 'Lead "João Silva" classificado como Quente — score 91',
      time: 'agora',
      colorClass: 'text-brand-amber',
    },
    {
      type: 'Mensagem',
      text: 'Follow-up enviado para 3 leads sem resposta há +24h',
      time: '2 min',
      colorClass: 'text-status-success',
    },
    {
      type: 'Proposta',
      text: 'Proposta gerada para Imóvel 4720 — Enviada via WhatsApp',
      time: '5 min',
      colorClass: 'text-status-info',
    },
  ];

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface/80 backdrop-blur-sm shadow-card overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-brand-border bg-brand-surface">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]/80" />
        <span className="ml-3 text-xs text-text-muted font-mono">
          Nexora · IA em execução
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-status-success">
          <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
          Live
        </span>
      </div>

      {/* Feed */}
      <div className="p-4 space-y-2.5">
        {events.map((event, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-xl bg-brand-bg/60 border border-brand-border/50"
          >
            <div className="mt-0.5 w-6 h-6 rounded-lg bg-brand-surface-2 flex items-center justify-center shrink-0">
              <Sparkles size={11} className="text-brand-amber" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-muted mb-0.5">{event.type}</p>
              <p className="text-sm text-text-primary leading-snug">{event.text}</p>
            </div>
            <span className={`text-xs shrink-0 mt-0.5 ${event.colorClass}`}>{event.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
