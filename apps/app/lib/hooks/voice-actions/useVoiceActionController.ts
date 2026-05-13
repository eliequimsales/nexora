'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  Lead,
  VoiceActionContext,
  VoiceActionExecutionResult,
  VoiceActionIntent,
  VoiceActionStatus,
  VoiceActionSuggestion,
} from '@/types';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort?(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

interface UseVoiceActionControllerProps {
  context: VoiceActionContext;
  onExecuteIntent: (intent: VoiceActionIntent) => Promise<VoiceActionExecutionResult>;
}

function normalizeVoiceText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildSuggestions(lead: Lead): VoiceActionSuggestion[] {
  const suggestions: VoiceActionSuggestion[] = [
    {
      id: 'summarize',
      label: 'Resumir lead',
      command: 'resuma este lead',
      reason: 'Baixo risco e util para recuperar contexto rapido.',
      availability: 'available',
    },
  ];

  if (!lead.aiClassification) {
    suggestions.push({
      id: 'classify',
      label: 'Classificar lead',
      command: 'classifique este lead',
      reason: 'Conecta com AI Actions ja existente.',
      availability: 'available',
    });
  }

  if (lead.status === 'new' || lead.status === 'contacted') {
    suggestions.push({
      id: 'respond',
      label: 'Gerar resposta',
      command: 'gere uma resposta inicial',
      reason: 'Boa acao inicial para leads novos ou sem resposta.',
      availability: 'available',
    });
  }

  if (lead.status === 'contacted' || lead.status === 'qualified') {
    suggestions.push({
      id: 'follow-up',
      label: 'Criar follow-up',
      command: 'crie um follow-up',
      reason: 'Prepara a proxima acao de contato sem sair da tela.',
      availability: 'available',
    });
  }

  suggestions.push({
    id: 'ask_copilot',
    label: 'Perguntar à IA',
    command: 'o que fazer com este lead',
    reason: 'Consulta contextual: a IA analisa o lead e sugere a proxima acao.',
    availability: 'available',
  });

  suggestions.push({
    id: 'task',
    label: 'Criar task',
    command: 'crie uma tarefa para amanha',
    reason: 'Cria uma tarefa vinculada a este lead com prazo amanha.',
    availability: 'available',
  });

  if (lead.aiClassification === 'hot' || lead.status === 'qualified') {
    suggestions.push({
      id: 'proposal',
      label: 'Mover para proposta',
      command: 'mova este lead para proposta',
      reason: 'Comando previsto, ainda sem mutacao conectada neste bloco.',
      availability: 'planned',
    });
  }

  return suggestions;
}

function extractNoteContent(transcript: string): string {
  const cleaned = transcript
    .replace(/^(anote que|anote|registre que|registre)\s*/i, '')
    .trim();
  return cleaned || transcript.trim();
}

function extractDueDays(normalized: string): number {
  if (normalized.includes('hoje')) return 0;
  if (normalized.includes('amanha') || normalized.includes('amanhã')) return 1;
  if (normalized.includes('depois de amanha')) return 2;
  if (normalized.includes('proxima semana') || normalized.includes('próxima semana')) return 7;
  if (normalized.includes('essa semana') || normalized.includes('esta semana')) return 5;
  const match = normalized.match(/em\s+(\d+)\s+dias?/);
  if (match) return parseInt(match[1], 10);
  return 1; // default: tomorrow
}

function extractTaskTitle(transcript: string, normalized: string): string {
  // Remove common command verbs and time references
  let title = transcript
    .replace(/^(crie?|criar|adicione?|adicionar|coloque?|lembra(?:r)?\s+de?)\s*(uma\s*)?(tarefa\s*)?/i, '')
    .replace(/\b(hoje|amanhã|amanha|depois\s+de\s+amanhã|essa\s+semana|esta\s+semana|próxima\s+semana|proxima\s+semana|em\s+\d+\s+dias?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return title || transcript.trim() || 'Tarefa criada por voz';
}

function dueDaysLabel(days: number): string {
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days === 7) return 'próxima semana';
  return `em ${days} dias`;
}

function parseIntent(transcript: string): VoiceActionIntent | null {
  const normalized = normalizeVoiceText(transcript);

  if (!normalized) {
    return null;
  }

  if (normalized.includes('resuma') || normalized.includes('resumo')) {
    return {
      type: 'summarize_lead',
      label: 'Resumir lead',
      description: 'Gera um resumo rapido do lead atual no proprio modal.',
      transcript,
      risk: 'low',
      confidence: 'high',
      availability: 'available',
      executionMode: 'direct',
      previewTitle: 'Resumo do lead',
      previewDescription: 'Acao interna sem mutacao externa nem efeito comercial.',
    };
  }

  if (normalized.includes('classifi')) {
    return {
      type: 'classify_lead',
      label: 'Classificar lead',
      description: 'Dispara a classificacao existente no modulo de AI Actions.',
      transcript,
      risk: 'medium',
      confidence: 'high',
      availability: 'available',
      executionMode: 'confirm',
      previewTitle: 'Classificacao por IA',
      previewDescription: 'Vai atualizar score, classificacao e atividade do lead.',
      aiActionType: 'ai_classify',
    };
  }

  if (normalized.includes('resposta') || normalized.includes('responder')) {
    return {
      type: 'generate_response',
      label: 'Gerar resposta inicial',
      description: 'Dispara a geracao de resposta no modulo de AI Actions.',
      transcript,
      risk: 'medium',
      confidence: 'high',
      availability: 'available',
      executionMode: 'confirm',
      previewTitle: 'Resposta inicial por IA',
      previewDescription: 'Vai gerar uma resposta e registrar o resultado no lead.',
      aiActionType: 'ai_respond',
    };
  }

  if (normalized.includes('follow')) {
    return {
      type: 'generate_follow_up',
      label: 'Gerar follow-up',
      description: 'Usa AI Actions para produzir um follow-up no contexto do lead.',
      transcript,
      risk: 'medium',
      confidence: 'high',
      availability: 'available',
      executionMode: 'confirm',
      previewTitle: 'Follow-up por IA',
      previewDescription: 'Vai gerar um follow-up e registrar a atividade correspondente.',
      aiActionType: 'ai_follow_up',
    };
  }

  if (
    normalized.includes('pergunte') ||
    normalized.includes('me diga') ||
    normalized.includes('o que fazer') ||
    normalized.includes('como abordar') ||
    normalized.includes('qual a melhor') ||
    normalized.includes('me ajude') ||
    normalized.includes('sugira')
  ) {
    return {
      type: 'ask_copilot',
      label: 'Perguntar para a IA',
      description: 'Usa o contexto do lead para gerar uma recomendacao de acao ou abordagem.',
      transcript,
      risk: 'low',
      confidence: 'medium',
      availability: 'available',
      executionMode: 'direct',
      previewTitle: 'Consulta contextual',
      previewDescription: 'A IA vai analisar o estado atual do lead e sugerir a melhor próxima ação.',
    };
  }

  if (normalized.includes('tarefa') || normalized.includes('task') || normalized.includes('lembrar') || normalized.includes('lembre')) {
    const dueDays = extractDueDays(normalized);
    const taskTitle = extractTaskTitle(transcript, normalized);
    return {
      type: 'create_task',
      label: 'Criar tarefa',
      description: 'Cria uma tarefa vinculada a este lead.',
      transcript,
      risk: 'medium',
      confidence: 'medium',
      availability: 'available',
      executionMode: 'confirm',
      previewTitle: 'Tarefa a criar',
      previewDescription: `Título: "${taskTitle}" — Prazo: ${dueDaysLabel(dueDays)}`,
      taskTitle,
      taskDueDays: dueDays,
    };
  }

  if (normalized.includes('proposta') || normalized.includes('proposal')) {
    return {
      type: 'move_to_proposal',
      label: 'Criar proposta',
      description: 'Cria um rascunho de proposta vinculado a este lead.',
      transcript,
      risk: 'high',
      confidence: 'medium',
      availability: 'available',
      executionMode: 'confirm',
      previewTitle: 'Criar rascunho de proposta',
      previewDescription: 'Será criado um rascunho de proposta em branco vinculado a este lead. Você precisará preencher os itens e valores na tela de Propostas.',
    };
  }

  if (normalized.includes('qualificado') || normalized.includes('qualificar')) {
    return {
      type: 'mark_qualified',
      label: 'Marcar como qualificado',
      description: 'Atualiza o status do lead para "Qualificado".',
      transcript,
      risk: 'medium',
      confidence: 'medium',
      availability: 'available',
      executionMode: 'confirm',
      previewTitle: 'Atualização de status',
      previewDescription: 'O status do lead será alterado para Qualificado. Essa ação pode ser revertida manualmente.',
    };
  }

  if (normalized.includes('nota') || normalized.includes('anote') || normalized.includes('registre')) {
    const noteContent = extractNoteContent(transcript);
    return {
      type: 'create_note',
      label: 'Registrar nota',
      description: 'Salva uma anotação no histórico de atividades do lead.',
      transcript,
      risk: 'low',
      confidence: 'medium',
      availability: 'available',
      executionMode: 'confirm',
      previewTitle: 'Nota a ser registrada',
      previewDescription: noteContent,
      noteContent,
    };
  }

  return {
    type: 'unknown',
    label: 'Comando ambiguo',
    description: 'O comando ainda nao foi reconhecido pelo conjunto inicial de intents.',
    transcript,
    risk: 'low',
    confidence: 'low',
    availability: 'blocked',
    executionMode: 'blocked',
    previewTitle: 'Refinar comando',
    previewDescription: 'Tente um comando como "resuma este lead" ou "gere uma resposta inicial".',
  };
}

export function useVoiceActionController({
  context,
  onExecuteIntent,
}: UseVoiceActionControllerProps) {
  const [status, setStatus] = useState<VoiceActionStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [intent, setIntent] = useState<VoiceActionIntent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<VoiceActionExecutionResult | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef('');

  const suggestions = buildSuggestions(context.lead);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setIsSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, []);

  function reset() {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    setStatus('idle');
    setTranscript('');
    setIntent(null);
    setErrorMessage(null);
    setOutcome(null);
  }

  function startListening() {
    if (typeof window === 'undefined') {
      return;
    }

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Ctor) {
      setStatus('error');
      setErrorMessage('Captura de voz indisponivel neste navegador. Edite a transcricao manualmente.');
      return;
    }

    setErrorMessage(null);
    setOutcome(null);
    setIntent(null);
    setTranscript('');

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onstart = () => {
      setStatus('listening');
    };

    recognition.onresult = (event) => {
      let nextTranscript = '';

      for (let index = 0; index < event.results.length; index++) {
        nextTranscript += event.results[index][0]?.transcript ?? '';
      }

      setTranscript(nextTranscript.trim());
      setStatus('transcribing');
    };

    recognition.onerror = (event) => {
      setStatus('error');
      setErrorMessage(`Nao foi possivel capturar a fala (${event.error}).`);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setStatus(transcriptRef.current ? 'transcribing' : 'idle');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  function interpretCurrentTranscript() {
    if (!transcript.trim()) {
      setStatus('ambiguous');
      setIntent(null);
      setErrorMessage('Fale um comando ou edite a transcricao antes de interpretar.');
      return;
    }

    setStatus('understanding');
    setErrorMessage(null);

    const nextIntent = parseIntent(transcript);

    if (!nextIntent || nextIntent.type === 'unknown') {
      setIntent(nextIntent);
      setStatus('ambiguous');
      setErrorMessage(nextIntent?.previewDescription ?? 'Nao foi possivel entender o comando.');
      return;
    }

    setIntent(nextIntent);
    setStatus('ready');
  }

  async function executeCurrentIntent() {
    if (!intent || intent.availability !== 'available') {
      return;
    }

    setStatus('executing');
    setErrorMessage(null);

    try {
      const result = await onExecuteIntent(intent);
      setOutcome(result);
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage('Nao foi possivel executar o comando agora.');
    }
  }

  function applySuggestion(command: string) {
    setTranscript(command);
    setOutcome(null);
    setErrorMessage(null);
    setIntent(null);
    setStatus('transcribing');
  }

  return {
    status,
    transcript,
    intent,
    suggestions,
    errorMessage,
    outcome,
    isSpeechSupported,
    setTranscript,
    startListening,
    stopListening,
    interpretCurrentTranscript,
    executeCurrentIntent,
    applySuggestion,
    reset,
  };
}
