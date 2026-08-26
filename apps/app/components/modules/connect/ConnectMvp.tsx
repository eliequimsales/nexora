'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  Edit3,
  FileWarning,
  History,
  MessageCircle,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { Badge, Button, Input } from '@/components/ui';
import { cn, formatCurrency } from '@/lib/utils';

type Tab = 'opportunities' | 'customers' | 'employees' | 'results' | 'settings';

type Objective =
  | 'recover'
  | 'recurrence'
  | 'ticket'
  | 'churn'
  | 'service';

type Company = {
  name: string;
  segment: string;
  averageTicket: number;
  returnCycleDays: number;
  objective: Objective;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  lastPurchaseDate: string;
  approximateValue: number;
  offering: string;
  contactPermission: boolean;
  notes?: string;
  birthday?: string;
  createdAt: string;
};

type EventType = 'purchase' | 'visit' | 'contact' | 'absence' | 'action_result';

type CustomerEvent = {
  id: string;
  customerId: string;
  type: EventType;
  date: string;
  value?: number;
  note?: string;
};

type OpportunityKind =
  | 'overdue_return'
  | 'high_value_no_contact'
  | 'missing_data'
  | 'upcoming_birthday'
  | 'repurchase';

type OpportunityStatus = 'open' | 'delegated' | 'done' | 'discarded';

type OpportunityRecord = {
  id: string;
  status: OpportunityStatus;
  delegatedTo?: 'recovery';
  copiedAt?: string;
  actionDoneAt?: string;
  result?: ResultStatus;
  recoveredValue?: number;
  resultNote?: string;
  updatedAt: string;
};

type Opportunity = {
  id: string;
  kind: OpportunityKind;
  title: string;
  estimatedValue: number;
  reason: string;
  customers: Customer[];
  urgency: 'baixa' | 'media' | 'alta';
  confidence: number;
  recommendedAction: string;
  message: string;
  recoveryEligible: boolean;
  effort: 'baixo' | 'medio';
};

type ResultStatus =
  | 'responded'
  | 'returned'
  | 'recovered'
  | 'no_response'
  | 'discarded'
  | 'action_done';

type StoredState = {
  company: Company | null;
  customers: Customer[];
  events: CustomerEvent[];
  ledger: Record<string, OpportunityRecord>;
  recoveryActive: boolean;
};

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  lastPurchaseDate: string;
  approximateValue: string;
  offering: string;
  contactPermission: boolean;
  notes: string;
  birthday: string;
};

const STORAGE_KEY = 'nexora-connect-mvp-v1';

const OBJECTIVE_LABELS: Record<Objective, string> = {
  recover: 'Recuperar quem parou',
  recurrence: 'Aumentar recorrencia',
  ticket: 'Aumentar ticket medio',
  churn: 'Reduzir abandono',
  service: 'Melhorar atendimento',
};

const EVENT_LABELS: Record<EventType, string> = {
  purchase: 'Compra',
  visit: 'Visita',
  contact: 'Contato',
  absence: 'Ausencia / pessoa parada',
  action_result: 'Resultado registrado',
};

const RESULT_LABELS: Record<ResultStatus, string> = {
  responded: 'Respondeu',
  returned: 'Voltou',
  recovered: 'Valor recuperado',
  no_response: 'Nao respondeu',
  discarded: 'Descartado',
  action_done: 'Acao feita',
};

const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  open: 'Aberta',
  delegated: 'Com Recovery',
  done: 'Concluida',
  discarded: 'Descartada',
};

// Titulo humano por tipo de oportunidade. Serve de lastro para um registro do
// ledger mesmo quando a oportunidade nao esta ativa agora (ex.: ninguem esta
// atrasado neste momento), garantindo que a tela de Resultados nunca precise
// mostrar um id interno.
const OPPORTUNITY_KIND_LABELS: Record<OpportunityKind, string> = {
  overdue_return: 'Passaram do ciclo de retorno',
  high_value_no_contact: 'Alto valor sem contato recente',
  repurchase: 'Perto da recompra',
  upcoming_birthday: 'Aniversario proximo',
  missing_data: 'Dados que travam recuperacao',
};

const OPPORTUNITY_KINDS = Object.keys(OPPORTUNITY_KIND_LABELS) as OpportunityKind[];

// Um registro so tem lastro se o id casar exatamente com o esquema de identidade
// atual (opp_<kind>). Registros orfaos (ids antigos com hash da carteira, dados
// corrompidos) retornam null e sao ignorados em receita e listagem.
const opportunityKindFromId = (id: string): OpportunityKind | null =>
  OPPORTUNITY_KINDS.find((kind) => id === `opp_${kind}`) ?? null;

const formatLocalIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayIso = () => formatLocalIso(new Date());

const daysAgoIso = (daysAgo: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return formatLocalIso(date);
};

const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const daysBetween = (fromIso: string, to = new Date()) => {
  const from = new Date(`${fromIso}T12:00:00`);
  const current = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 12);
  const diff = current.getTime() - from.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
};

const parseMoney = (value: string | number | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number) => Math.max(0, Math.round(value / 10) * 10);

// A identidade da oportunidade e o tipo de sinal, nunca o grupo de pessoas.
// Se o id dependesse da carteira, mudar ciclo ou adicionar uma pessoa criaria
// uma oportunidade nova e o historico (inclusive "delegada ao Recovery") sumiria.
const makeOpportunityId = (kind: OpportunityKind) => `opp_${kind}`;

const percent = (value: number) => `${Math.round(value * 100)}%`;

const peopleLabel = (count: number) => (count === 1 ? '1 pessoa' : `${count} pessoas`);

const emptyCustomerForm = (): CustomerForm => ({
  name: '',
  phone: '',
  email: '',
  lastPurchaseDate: todayIso(),
  approximateValue: '',
  offering: '',
  contactPermission: true,
  notes: '',
  birthday: '',
});

const defaultCompany: Company = {
  name: '',
  segment: 'Servicos recorrentes',
  averageTicket: 150,
  returnCycleDays: 30,
  objective: 'recover',
};

const demoCompany: Company = {
  name: 'Studio Aurora',
  segment: 'Estetica e beleza',
  averageTicket: 180,
  returnCycleDays: 30,
  objective: 'recover',
};

const emptyState: StoredState = {
  company: null,
  customers: [],
  events: [],
  ledger: {},
  recoveryActive: false,
};

function buildDemoCustomers(): Customer[] {
  const createdAt = `${todayIso()}T12:00:00.000Z`;

  return [
    {
      id: 'demo_mariana_alves',
      name: 'Mariana Alves',
      phone: '11988887777',
      email: 'mariana@email.com',
      lastPurchaseDate: daysAgoIso(64),
      approximateValue: 280,
      offering: 'Limpeza de pele premium',
      contactPermission: true,
      notes: 'Gostou do atendimento e pediu aviso quando abrisse horario.',
      birthday: '',
      createdAt,
    },
    {
      id: 'demo_rafael_costa',
      name: 'Rafael Costa',
      phone: '11977776666',
      email: '',
      lastPurchaseDate: daysAgoIso(38),
      approximateValue: 520,
      offering: 'Pacote mensal',
      contactPermission: true,
      notes: 'Alto valor, sem contato recente.',
      birthday: '',
      createdAt,
    },
    {
      id: 'demo_bianca_torres',
      name: 'Bianca Torres',
      phone: '',
      email: 'bianca@email.com',
      lastPurchaseDate: daysAgoIso(21),
      approximateValue: 180,
      offering: 'Design de sobrancelhas',
      contactPermission: false,
      notes: 'Dados precisam ser corrigidos antes de acionar.',
      birthday: '',
      createdAt,
    },
    {
      id: 'demo_lucas_pereira',
      name: 'Lucas Pereira',
      phone: '11966665555',
      email: 'lucas@email.com',
      lastPurchaseDate: daysAgoIso(26),
      approximateValue: 160,
      offering: 'Corte + barba',
      contactPermission: true,
      notes: 'Normalmente volta perto de 30 dias.',
      birthday: '',
      createdAt,
    },
  ];
}

function buildInitialEvents(customers: Customer[]): CustomerEvent[] {
  return customers.map((customer) => ({
    id: `evt_${customer.id}_purchase`,
    customerId: customer.id,
    type: 'purchase',
    date: customer.lastPurchaseDate,
    value: customer.approximateValue,
    note: customer.offering,
  }));
}

function loadStoredState(): StoredState {
  if (typeof window === 'undefined') return emptyState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyState;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      company: parsed.company ?? null,
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      ledger: parsed.ledger ?? {},
      recoveryActive: Boolean(parsed.recoveryActive),
    };
  } catch {
    return emptyState;
  }
}

function birthdayWithinDays(birthdayIso: string | undefined, windowDays: number) {
  if (!birthdayIso) return false;
  const [, month, day] = birthdayIso.split('-').map(Number);
  if (!month || !day) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const birthday = new Date(currentYear, month - 1, day, 12);
  if (birthday < now) birthday.setFullYear(currentYear + 1);
  const diffDays = Math.ceil((birthday.getTime() - now.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays <= windowDays;
}

function signalEngine(company: Company | null, customers: Customer[]): Opportunity[] {
  if (!company || customers.length === 0) return [];

  const cycle = Math.max(1, company.returnCycleDays);
  const averageTicket = Math.max(1, company.averageTicket);

  // Cada pessoa pode contribuir valor para no maximo UMA oportunidade aberta.
  // Sem isso, alguem que e alto valor E passou do ciclo somaria receita em duas
  // manchetes ao mesmo tempo, inflando a Receita Provavel. Reservamos por
  // prioridade de negocio (maior dinheiro/urgencia primeiro) e cada bucket
  // seguinte so enxerga quem ainda esta livre.
  const claimed = new Set<string>();
  const isFree = (customer: Customer) => !claimed.has(customer.id);
  const claim = (list: Customer[]) => {
    list.forEach((customer) => claimed.add(customer.id));
    return list;
  };

  const canContact = (customer: Customer) => customer.contactPermission && Boolean(customer.phone);

  // 1º) Alto valor sem contato recente — o maior dinheiro, urgencia alta.
  const highValue = claim(
    customers.filter(
      (customer) =>
        canContact(customer) &&
        customer.approximateValue >= averageTicket * 1.5 &&
        daysBetween(customer.lastPurchaseDate) >= Math.max(10, Math.floor(cycle * 0.65))
    )
  );

  // 2º) Passou do ciclo de retorno — cliente em risco de virar inativo.
  const overdue = claim(
    customers.filter(
      (customer) =>
        isFree(customer) && canContact(customer) && daysBetween(customer.lastPurchaseDate) > cycle
    )
  );

  // 3º) Chegando na recompra — ainda ativo, contato preventivo.
  const repurchase = claim(
    customers.filter((customer) => {
      const days = daysBetween(customer.lastPurchaseDate);
      return (
        isFree(customer) &&
        canContact(customer) &&
        days >= Math.floor(cycle * 0.75) &&
        days <= cycle
      );
    })
  );

  // 4º) Aniversario proximo — sinal leve, so para quem sobrou.
  const birthdays = claim(
    customers.filter(
      (customer) => isFree(customer) && canContact(customer) && birthdayWithinDays(customer.birthday, 14)
    )
  );

  // Dados incompletos — disjunto por definicao (exige falta de telefone/permissao),
  // nunca soma valor (estimatedValue 0), entao nao participa da reserva.
  const missingData = customers.filter(
    (customer) => !customer.phone || !customer.contactPermission || !customer.lastPurchaseDate
  );

  const opportunities: Opportunity[] = [];

  if (overdue.length > 0) {
    const avgDaysLate =
      overdue.reduce((sum, customer) => sum + (daysBetween(customer.lastPurchaseDate) - cycle), 0) /
      overdue.length;

    opportunities.push({
      id: makeOpportunityId('overdue_return'),
      kind: 'overdue_return',
      title:
        overdue.length === 1
          ? `${overdue[0].name} passou do ciclo de retorno`
          : `${overdue.length} pessoas passaram do ciclo de retorno`,
      estimatedValue: roundMoney(overdue.reduce((sum, customer) => sum + customer.approximateValue * 0.45, 0)),
      reason: `Estao em media ${Math.round(avgDaysLate)} dias alem do ciclo esperado de ${cycle} dias.`,
      customers: overdue,
      urgency: avgDaysLate > cycle ? 'alta' : 'media',
      confidence: Math.min(0.92, 0.58 + overdue.length * 0.06),
      recommendedAction: 'Enviar mensagem curta de retorno com contexto do ultimo servico comprado.',
      message: buildRecoveryMessage(company, overdue, 'overdue_return'),
      recoveryEligible: true,
      effort: overdue.length > 3 ? 'medio' : 'baixo',
    });
  }

  if (highValue.length > 0) {
    opportunities.push({
      id: makeOpportunityId('high_value_no_contact'),
      kind: 'high_value_no_contact',
      title:
        highValue.length === 1
          ? `${highValue[0].name} e pessoa de alto valor sem contato recente`
          : `${highValue.length} pessoas de alto valor sem contato recente`,
      estimatedValue: roundMoney(highValue.reduce((sum, customer) => sum + customer.approximateValue * 0.55, 0)),
      reason: `Ticket acima da media de ${formatCurrency(averageTicket)} e nenhum retorno recente registrado.`,
      customers: highValue,
      urgency: 'alta',
      confidence: Math.min(0.9, 0.62 + highValue.length * 0.05),
      recommendedAction: 'Fazer abordagem individual, sem promocao agressiva, para retomar relacionamento.',
      message: buildRecoveryMessage(company, highValue, 'high_value_no_contact'),
      recoveryEligible: true,
      effort: 'medio',
    });
  }

  if (repurchase.length > 0) {
    opportunities.push({
      id: makeOpportunityId('repurchase'),
      kind: 'repurchase',
      title:
        repurchase.length === 1
          ? `${repurchase[0].name} esta perto da recompra`
          : `${repurchase.length} pessoas estao perto da recompra`,
      estimatedValue: roundMoney(repurchase.reduce((sum, customer) => sum + customer.approximateValue * 0.35, 0)),
      reason: `Estao chegando no ciclo normal de ${cycle} dias. O contato agora evita que virem inativos.`,
      customers: repurchase,
      urgency: 'media',
      confidence: Math.min(0.86, 0.54 + repurchase.length * 0.05),
      recommendedAction: 'Enviar lembrete util antes da pessoa esfriar.',
      message: buildRecoveryMessage(company, repurchase, 'repurchase'),
      recoveryEligible: true,
      effort: 'baixo',
    });
  }

  if (birthdays.length > 0) {
    opportunities.push({
      id: makeOpportunityId('upcoming_birthday'),
      kind: 'upcoming_birthday',
      title:
        birthdays.length === 1
          ? `${birthdays[0].name} faz aniversario em breve`
          : `${birthdays.length} pessoas fazem aniversario em breve`,
      estimatedValue: roundMoney(birthdays.reduce((sum, customer) => sum + customer.approximateValue * 0.25, 0)),
      reason: 'Aniversario proximo abre uma janela natural para reaproximacao e convite de retorno.',
      customers: birthdays,
      urgency: 'media',
      confidence: 0.5,
      recommendedAction: 'Enviar mensagem pessoal de aniversario com convite leve para voltar.',
      message: buildRecoveryMessage(company, birthdays, 'upcoming_birthday'),
      recoveryEligible: false,
      effort: 'baixo',
    });
  }

  if (missingData.length > 0) {
    opportunities.push({
      id: makeOpportunityId('missing_data'),
      kind: 'missing_data',
      title:
        missingData.length === 1
          ? `${missingData[0].name} esta com dados que travam recuperacao`
          : `${missingData.length} pessoas estao com dados que travam recuperacao`,
      estimatedValue: 0,
      reason: 'Sem telefone ou permissao de contato, a empresa nao consegue transformar essa pessoa em acao.',
      customers: missingData,
      urgency: 'baixa',
      confidence: 0.44,
      recommendedAction: 'Corrigir telefone e permissao antes de qualquer acao comercial.',
      message: 'Antes de acionar, corrija telefone/WhatsApp e permissao de contato desta pessoa.',
      recoveryEligible: false,
      effort: 'medio',
    });
  }

  return opportunities.sort((a, b) => {
    const urgencyWeight = { alta: 3, media: 2, baixa: 1 };
    const aScore = a.estimatedValue * a.confidence * urgencyWeight[a.urgency];
    const bScore = b.estimatedValue * b.confidence * urgencyWeight[b.urgency];
    return bScore - aScore;
  });
}

function buildRecoveryMessage(company: Company, customers: Customer[], kind: OpportunityKind) {
  const first = customers[0];
  const customerName = first?.name.split(' ')[0] ?? 'tudo bem';
  const offering = first?.offering || 'seu ultimo atendimento';
  const companyName = company.name || 'nossa equipe';

  if (kind === 'high_value_no_contact') {
    return `Oi, ${customerName}! Aqui e da ${companyName}. Vi que faz um tempo desde ${offering} e queria saber se posso te ajudar a marcar um retorno ou ajustar algo para voce.`;
  }

  if (kind === 'repurchase') {
    return `Oi, ${customerName}! Passando para te lembrar que ja esta perto do periodo normal de retorno de ${offering}. Quer que eu veja um horario/opcao para voce?`;
  }

  if (kind === 'upcoming_birthday') {
    return `Oi, ${customerName}! Seu aniversario esta chegando e a ${companyName} lembrou de voce. Posso te mandar uma condicao especial para voltar esta semana?`;
  }

  return `Oi, ${customerName}! Aqui e da ${companyName}. Notei que faz um tempo desde ${offering} e queria te chamar para voltar. Quer que eu veja a melhor opcao para voce?`;
}

function mergeOpportunity(opportunity: Opportunity, ledger: Record<string, OpportunityRecord>) {
  return {
    ...opportunity,
    record: ledger[opportunity.id],
  };
}

function getOpenOpportunities(opportunities: Opportunity[], ledger: Record<string, OpportunityRecord>) {
  return opportunities.filter((opportunity) => {
    const status = ledger[opportunity.id]?.status ?? 'open';
    return status === 'open' || status === 'delegated';
  });
}

function getCustomerStatus(customer: Customer, company: Company | null) {
  if (!company) return { label: 'Sem contexto', variant: 'default' as const };
  if (!customer.phone || !customer.contactPermission) {
    return { label: 'Dados travam acao', variant: 'warning' as const };
  }

  const days = daysBetween(customer.lastPurchaseDate);
  if (days > company.returnCycleDays) return { label: 'Em risco', variant: 'error' as const };
  if (customer.approximateValue >= company.averageTicket * 1.5) return { label: 'Alto valor', variant: 'amber' as const };
  if (days >= company.returnCycleDays * 0.75) return { label: 'Recompra perto', variant: 'info' as const };
  return { label: 'Ativo', variant: 'success' as const };
}

export function ConnectMvp() {
  const [state, setState] = useState<StoredState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('opportunities');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerForm>(emptyCustomerForm);
  const [eventForm, setEventForm] = useState({
    type: 'contact' as EventType,
    date: todayIso(),
    value: '',
    note: '',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resultDraft, setResultDraft] = useState({
    result: 'responded' as ResultStatus,
    recoveredValue: '',
    note: '',
  });

  useEffect(() => {
    setState(loadStoredState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const opportunities = useMemo(
    () => signalEngine(state.company, state.customers),
    [state.company, state.customers]
  );
  const openOpportunities = useMemo(
    () => getOpenOpportunities(opportunities, state.ledger),
    [opportunities, state.ledger]
  );
  const selectedOpportunity =
    opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) ?? openOpportunities[0] ?? null;
  const selectedCustomer =
    state.customers.find((customer) => customer.id === selectedCustomerId) ?? state.customers[0] ?? null;

  const likelyRevenue = openOpportunities.reduce((sum, opportunity) => sum + opportunity.estimatedValue, 0);
  // Receita Recuperada so conta registros com lastro (id valido) e com valor real
  // informado — nunca registros orfaos nem valores sem comprovacao.
  const recoveredRevenue = Object.values(state.ledger).reduce((sum, record) => {
    if (!opportunityKindFromId(record.id)) return sum;
    if (record.result !== 'recovered' && record.result !== 'returned') return sum;
    return sum + (record.recoveredValue ?? 0);
  }, 0);
  const riskCustomers = state.customers.filter((customer) => {
    if (!state.company) return false;
    return customer.contactPermission && Boolean(customer.phone) && daysBetween(customer.lastPurchaseDate) > state.company.returnCycleDays;
  });
  const bestAction = openOpportunities[0]?.recommendedAction ?? 'Adicione sua carteira para o Connect encontrar dinheiro parado.';
  const recoveryOpportunities = openOpportunities.filter((opportunity) => opportunity.recoveryEligible);

  function patchState(patch: Partial<StoredState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function saveCompany(company: Company) {
    patchState({ company });
    setActiveTab('opportunities');
  }

  function loadDemo() {
    const customers = buildDemoCustomers();
    setState({
      company: demoCompany,
      customers,
      events: buildInitialEvents(customers),
      ledger: {},
      recoveryActive: false,
    });
    setSelectedOpportunityId(null);
    setSelectedCustomerId(customers[0]?.id ?? null);
    setActiveTab('opportunities');
  }

  function addCustomer() {
    const name = customerForm.name.trim();
    if (!name) return;

    const customer: Customer = {
      id: makeId('cus'),
      name,
      phone: customerForm.phone.trim(),
      email: customerForm.email.trim(),
      lastPurchaseDate: customerForm.lastPurchaseDate || todayIso(),
      approximateValue:
        parseMoney(customerForm.approximateValue) || state.company?.averageTicket || defaultCompany.averageTicket,
      offering: customerForm.offering.trim() || 'Compra / visita',
      contactPermission: customerForm.contactPermission,
      notes: customerForm.notes.trim(),
      birthday: customerForm.birthday,
      createdAt: new Date().toISOString(),
    };

    const event: CustomerEvent = {
      id: makeId('evt'),
      customerId: customer.id,
      type: 'purchase',
      date: customer.lastPurchaseDate,
      value: customer.approximateValue,
      note: customer.offering,
    };

    patchState({
      customers: [customer, ...state.customers],
      events: [event, ...state.events],
    });
    setCustomerForm(emptyCustomerForm());
    setSelectedCustomerId(customer.id);
    setActiveTab('opportunities');
  }

  function addDemoCustomers() {
    const existingKeys = new Set(
      state.customers.map((customer) => `${customer.name.toLowerCase()}|${customer.phone}`)
    );
    const customers = buildDemoCustomers().filter(
      (customer) => !existingKeys.has(`${customer.name.toLowerCase()}|${customer.phone}`)
    );

    if (customers.length > 0) {
      patchState({
        customers: [...customers, ...state.customers],
        events: [...buildInitialEvents(customers), ...state.events],
      });
    }

    setActiveTab('opportunities');
  }

  function addEvent(customerId: string) {
    const event: CustomerEvent = {
      id: makeId('evt'),
      customerId,
      type: eventForm.type,
      date: eventForm.date || todayIso(),
      value: parseMoney(eventForm.value) || undefined,
      note: eventForm.note.trim(),
    };

    const updatedCustomers = state.customers.map((customer) => {
      if (customer.id !== customerId) return customer;
      if (event.type !== 'purchase' && event.type !== 'visit') return customer;
      return {
        ...customer,
        lastPurchaseDate: event.date,
        approximateValue: event.value ?? customer.approximateValue,
      };
    });

    patchState({
      customers: updatedCustomers,
      events: [event, ...state.events],
    });
    setEventForm({ type: 'contact', date: todayIso(), value: '', note: '' });
  }

  function updateOpportunity(id: string, patch: Partial<OpportunityRecord>) {
    setState((current) => ({
      ...current,
      ledger: {
        ...current.ledger,
        [id]: {
          ...current.ledger[id],
          id,
          status: patch.status ?? current.ledger[id]?.status ?? 'open',
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  }

  async function copyMessage(opportunity: Opportunity) {
    try {
      await navigator.clipboard.writeText(opportunity.message);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = opportunity.message;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopiedId(opportunity.id);
    updateOpportunity(opportunity.id, { copiedAt: new Date().toISOString() });
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  function delegateToRecovery(opportunity: Opportunity) {
    patchState({ recoveryActive: true });
    updateOpportunity(opportunity.id, {
      status: 'delegated',
      delegatedTo: 'recovery',
    });
  }

  function activateRecovery() {
    patchState({ recoveryActive: true });
    const target = recoveryOpportunities[0];
    if (target) delegateToRecovery(target);
  }

  function markActionDone(opportunity: Opportunity) {
    updateOpportunity(opportunity.id, {
      status: 'open',
      result: 'action_done',
      actionDoneAt: new Date().toISOString(),
    });
  }

  function registerResult(opportunity: Opportunity) {
    const recoveredValue = parseMoney(resultDraft.recoveredValue);
    const result = resultDraft.result;
    const totalRecovered = recoveredValue || opportunity.estimatedValue;
    const recoveredPerPerson =
      opportunity.customers.length > 0 ? Math.round(totalRecovered / opportunity.customers.length) : totalRecovered;

    updateOpportunity(opportunity.id, {
      status: result === 'discarded' ? 'discarded' : 'done',
      result,
      recoveredValue:
        result === 'returned' || result === 'recovered'
          ? totalRecovered
          : recoveredValue || undefined,
      resultNote: resultDraft.note.trim(),
    });
    const resultEvents = opportunity.customers.map<CustomerEvent>((customer) => ({
      id: makeId('evt'),
      customerId: customer.id,
      type: 'action_result',
      date: todayIso(),
      value: result === 'returned' || result === 'recovered' ? recoveredPerPerson : undefined,
      note: `${RESULT_LABELS[result]} em ${opportunity.title}`,
    }));
    patchState({ events: [...resultEvents, ...state.events] });
    setResultDraft({ result: 'responded', recoveredValue: '', note: '' });
    setActiveTab('results');
  }

  function discardOpportunity(opportunity: Opportunity) {
    updateOpportunity(opportunity.id, {
      status: 'discarded',
      result: 'discarded',
    });
  }

  function resetLocalState() {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(emptyState);
    setActiveTab('opportunities');
    setSelectedOpportunityId(null);
    setSelectedCustomerId(null);
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-brand-bg text-text-primary">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
          <div className="flex items-center gap-3 rounded-lg border border-brand-border bg-brand-surface px-4 py-3 text-sm text-text-secondary">
            <RefreshCcw size={16} className="animate-spin text-brand-amber" />
            Preparando sua carteira...
          </div>
        </div>
      </main>
    );
  }

  if (!state.company) {
    return <OnboardingScreen onSave={saveCompany} onLoadDemo={loadDemo} />;
  }

  return (
    <main className="min-h-screen bg-brand-bg text-text-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col lg:flex-row">
        <aside className="border-b border-brand-border bg-sidebar-bg/95 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block lg:px-5">
            <div>
              <p className="text-xs font-medium uppercase text-brand-amber">Nexora</p>
              <h1 className="mt-1 text-lg font-semibold text-text-primary">Dinheiro na carteira</h1>
              <p className="mt-1 hidden text-xs text-text-muted lg:block">
                Dinheiro primeiro. Cadastro depois.
              </p>
            </div>
            <Badge variant="success" size="sm" className="lg:mt-4">
              Pronto para testar
            </Badge>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-3">
            <NavButton
              active={activeTab === 'opportunities'}
              icon={Target}
              label="Oportunidades"
              onClick={() => setActiveTab('opportunities')}
            />
            <NavButton
              active={activeTab === 'customers'}
              icon={Users}
              label="Carteira"
              onClick={() => setActiveTab('customers')}
            />
            <NavButton
              active={activeTab === 'employees'}
              icon={Bot}
              label="Recovery"
              onClick={() => setActiveTab('employees')}
            />
            <NavButton
              active={activeTab === 'results'}
              icon={WalletCards}
              label="Resultados"
              onClick={() => setActiveTab('results')}
            />
            <NavButton
              active={activeTab === 'settings'}
              icon={Settings}
              label="Ajustes"
              onClick={() => setActiveTab('settings')}
            />
          </nav>
        </aside>

        <section className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <HeaderBar company={state.company} />

          {activeTab === 'opportunities' && (
            <OpportunitiesView
              company={state.company}
              opportunities={opportunities}
              openOpportunities={openOpportunities}
              ledger={state.ledger}
              likelyRevenue={likelyRevenue}
              riskCustomers={riskCustomers.length}
              bestAction={bestAction}
              selectedOpportunity={selectedOpportunity}
              copiedId={copiedId}
              resultDraft={resultDraft}
              onSelect={(id) => setSelectedOpportunityId(id)}
              onCopy={copyMessage}
              onDelegate={delegateToRecovery}
              onMarkDone={markActionDone}
              onRegisterResult={registerResult}
              onDiscard={discardOpportunity}
              onResultDraftChange={setResultDraft}
              onAddCustomer={() => setActiveTab('customers')}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              company={state.company}
              customers={state.customers}
              events={state.events}
              selectedCustomer={selectedCustomer}
              customerForm={customerForm}
              eventForm={eventForm}
              onCustomerFormChange={setCustomerForm}
              onEventFormChange={setEventForm}
              onAddCustomer={addCustomer}
              onAddDemoCustomers={addDemoCustomers}
              onSelectCustomer={setSelectedCustomerId}
              onAddEvent={addEvent}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeesView
              recoveryActive={state.recoveryActive}
              recoveryOpportunities={recoveryOpportunities}
              onActivateRecovery={activateRecovery}
              onOpenOpportunity={(id) => {
                setSelectedOpportunityId(id);
                setActiveTab('opportunities');
              }}
            />
          )}

          {activeTab === 'results' && (
            <ResultsView
              ledger={state.ledger}
              opportunities={opportunities}
              events={state.events}
              customers={state.customers}
              recoveredRevenue={recoveredRevenue}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              company={state.company}
              customersCount={state.customers.length}
              eventsCount={state.events.length}
              onSaveCompany={(company) => patchState({ company })}
              onReset={resetLocalState}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function OnboardingScreen({
  onSave,
  onLoadDemo,
}: {
  onSave: (company: Company) => void;
  onLoadDemo: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    segment: defaultCompany.segment,
    averageTicket: String(defaultCompany.averageTicket),
    returnCycleDays: String(defaultCompany.returnCycleDays),
    objective: defaultCompany.objective,
  });

  const canSubmit = form.name.trim().length > 1 && parseMoney(form.averageTicket) > 0 && Number(form.returnCycleDays) > 0;

  function submit() {
    if (!canSubmit) return;
    onSave({
      name: form.name.trim(),
      segment: form.segment.trim() || defaultCompany.segment,
      averageTicket: parseMoney(form.averageTicket),
      returnCycleDays: Math.max(1, Number(form.returnCycleDays)),
      objective: form.objective,
    });
  }

  return (
    <main className="min-h-screen bg-brand-bg text-text-primary">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-5">
          <Badge variant="amber" size="lg">
            Nexora
          </Badge>
          <div className="space-y-3">
            <h1 className="max-w-xl text-3xl font-semibold leading-tight text-text-primary sm:text-4xl">
              Encontre dinheiro escondido na sua carteira de clientes.
            </h1>
            <p className="max-w-lg text-sm leading-6 text-text-secondary">
              Informe poucos dados. O Connect mostra quem pode voltar,
              quanto pode valer e qual acao fazer agora.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ValuePill icon={Database} title="Carteira entra" text="Nome, WhatsApp e ultima compra" />
            <ValuePill icon={Target} title="Dinheiro aparece" text="Receita provavel e motivo" />
            <ValuePill icon={Bot} title="Recovery trabalha" text="A oportunidade vira execucao" />
          </div>
        </section>

        <section className="rounded-lg border border-brand-border bg-brand-surface p-5 shadow-panel">
          <div className="mb-5">
            <p className="text-xs font-medium uppercase text-brand-amber">Primeiro passo</p>
            <h2 className="mt-1 text-xl font-semibold text-text-primary">Calibre onde procurar dinheiro</h2>
            <p className="mt-1 text-sm text-text-muted">
              Ticket e ciclo dizem quando alguem virou dinheiro parado.
            </p>
          </div>

          <div className="grid gap-4">
            <Input
              label="Nome da empresa"
              placeholder="Ex.: Studio Aurora"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
            <Input
              label="Segmento"
              placeholder="Ex.: estetica, barbearia, clinica, escola"
              value={form.segment}
              onChange={(event) => setForm({ ...form, segment: event.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Ticket medio aproximado"
                placeholder="150"
                value={form.averageTicket}
                onChange={(event) => setForm({ ...form, averageTicket: event.target.value })}
                iconLeft={<Banknote size={15} />}
                inputMode="decimal"
              />
              <Input
                label="Ciclo medio de retorno"
                placeholder="30"
                value={form.returnCycleDays}
                onChange={(event) => setForm({ ...form, returnCycleDays: event.target.value })}
                iconLeft={<CalendarClock size={15} />}
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-text-secondary">Objetivo principal</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(OBJECTIVE_LABELS) as [Objective, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, objective: value })}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      form.objective === value
                        ? 'border-brand-amber bg-brand-amber-subtle text-text-primary'
                        : 'border-brand-border bg-brand-surface-2 text-text-secondary hover:border-brand-border-2 hover:text-text-primary'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Button variant="primary" size="xl" disabled={!canSubmit} onClick={submit} className="mt-2 w-full">
              Encontrar dinheiro na carteira
              <ArrowRight size={16} />
            </Button>
            <Button variant="outline" size="xl" onClick={onLoadDemo} className="w-full">
              <Sparkles size={16} />
              Usar demo Studio Aurora
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function HeaderBar({ company }: { company: Company }) {
  return (
    <header className="mb-5 flex flex-col gap-3 border-b border-brand-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase text-text-muted">{company.segment}</p>
        <h2 className="text-2xl font-semibold text-text-primary">{company.name}</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="default" size="lg">
          Ticket {formatCurrency(company.averageTicket)}
        </Badge>
        <Badge variant="default" size="lg">
          Ciclo {company.returnCycleDays} dias
        </Badge>
        <Badge variant="amber" size="lg">
          {OBJECTIVE_LABELS[company.objective]}
        </Badge>
      </div>
    </header>
  );
}

function OpportunitiesView(props: {
  company: Company;
  opportunities: Opportunity[];
  openOpportunities: Opportunity[];
  ledger: Record<string, OpportunityRecord>;
  likelyRevenue: number;
  riskCustomers: number;
  bestAction: string;
  selectedOpportunity: Opportunity | null;
  copiedId: string | null;
  resultDraft: { result: ResultStatus; recoveredValue: string; note: string };
  onSelect: (id: string) => void;
  onCopy: (opportunity: Opportunity) => void;
  onDelegate: (opportunity: Opportunity) => void;
  onMarkDone: (opportunity: Opportunity) => void;
  onRegisterResult: (opportunity: Opportunity) => void;
  onDiscard: (opportunity: Opportunity) => void;
  onResultDraftChange: (draft: { result: ResultStatus; recoveredValue: string; note: string }) => void;
  onAddCustomer: () => void;
}) {
  const selected = props.selectedOpportunity;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 lg:grid-cols-5">
        <MoneyMetric
          icon={Banknote}
          label="Dinheiro encontrado"
          value={formatCurrency(props.likelyRevenue)}
          sub="Valor provavel esperando acao"
          variant="success"
          featured
          className="lg:col-span-2"
        />
        <MoneyMetric
          icon={Target}
          label="Acoes prontas"
          value={String(props.openOpportunities.length)}
          sub="O que vale agir agora"
          variant="amber"
        />
        <MoneyMetric
          icon={FileWarning}
          label="Carteira em risco"
          value={String(props.riskCustomers)}
          sub={`Acima de ${props.company.returnCycleDays} dias`}
          variant="warning"
        />
        <MoneyMetric
          icon={Sparkles}
          label="Acao que pode trazer dinheiro"
          value={props.openOpportunities[0] ? '1 acao' : 'Sem acao'}
          sub={props.bestAction}
          variant="info"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-brand-border bg-brand-surface">
          <div className="flex items-center justify-between gap-3 border-b border-brand-border px-4 py-3">
            <div>
              <h3 className="font-semibold text-text-primary">Dinheiro encontrado</h3>
              <p className="text-xs text-text-muted">Priorize pelo dinheiro provavel, motivo e acao.</p>
            </div>
            <Button variant="outline" size="sm" onClick={props.onAddCustomer}>
              <Plus size={14} />
              Adicionar
            </Button>
          </div>

          {props.openOpportunities.length === 0 ? (
            <EmptyMoneyState onAddCustomer={props.onAddCustomer} />
          ) : (
            <div className="divide-y divide-brand-border">
              {props.openOpportunities.map((opportunity) => {
                const record = props.ledger[opportunity.id];
                const active = selected?.id === opportunity.id;
                return (
                  <button
                    key={opportunity.id}
                    type="button"
                    onClick={() => props.onSelect(opportunity.id)}
                    className={cn(
                      'block w-full px-4 py-4 text-left transition-colors',
                      active ? 'bg-brand-surface-2' : 'hover:bg-brand-surface-2/70'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-text-primary">{opportunity.title}</p>
                          <UrgencyBadge urgency={opportunity.urgency} />
                          {record?.status === 'delegated' ? (
                            <Badge variant="ai" size="sm" dot>
                              Recovery
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-text-muted">{opportunity.reason}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-status-success">
                        {formatCurrency(opportunity.estimatedValue)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span>{peopleLabel(opportunity.customers.length)}</span>
                      <span className="h-1 w-1 rounded-full bg-text-muted" />
                      <span>Chance {percent(opportunity.confidence)}</span>
                      <span className="h-1 w-1 rounded-full bg-text-muted" />
                      <span>Trabalho {opportunity.effort}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selected ? (
          <OpportunityDetail
            opportunity={selected}
            record={props.ledger[selected.id]}
            copied={props.copiedId === selected.id}
            resultDraft={props.resultDraft}
            onCopy={() => props.onCopy(selected)}
            onDelegate={() => props.onDelegate(selected)}
            onMarkDone={() => props.onMarkDone(selected)}
            onRegisterResult={() => props.onRegisterResult(selected)}
            onDiscard={() => props.onDiscard(selected)}
            onResultDraftChange={props.onResultDraftChange}
          />
        ) : (
          <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
            <p className="text-sm text-text-muted">
              Adicione a carteira para o Connect encontrar o primeiro dinheiro parado.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function OpportunityDetail({
  opportunity,
  record,
  copied,
  resultDraft,
  onCopy,
  onDelegate,
  onMarkDone,
  onRegisterResult,
  onDiscard,
  onResultDraftChange,
}: {
  opportunity: Opportunity;
  record?: OpportunityRecord;
  copied: boolean;
  resultDraft: { result: ResultStatus; recoveredValue: string; note: string };
  onCopy: () => void;
  onDelegate: () => void;
  onMarkDone: () => void;
  onRegisterResult: () => void;
  onDiscard: () => void;
  onResultDraftChange: (draft: { result: ResultStatus; recoveredValue: string; note: string }) => void;
}) {
  const merged = mergeOpportunity(opportunity, record ? { [opportunity.id]: record } : {});

  return (
    <article className="rounded-lg border border-brand-border bg-brand-surface">
      <div className="border-b border-brand-border px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-text-primary">{opportunity.title}</h3>
              <UrgencyBadge urgency={opportunity.urgency} />
            </div>
            <p className="mt-1 text-sm text-text-muted">{opportunity.reason}</p>
          </div>
          <div className="rounded-lg border border-status-success/20 bg-status-success-muted px-3 py-2 text-right">
            <p className="text-xs text-status-success">Receita provavel</p>
            <p className="text-lg font-semibold text-status-success">{formatCurrency(opportunity.estimatedValue)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_0.9fr]">
        <section className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-text-muted">Acao para recuperar dinheiro</p>
            <div className="rounded-lg border border-brand-amber/20 bg-brand-amber-subtle p-4">
              <p className="text-sm leading-6 text-text-primary">{opportunity.recommendedAction}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-text-muted">Mensagem para copiar</p>
            <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-4">
              <p className="text-sm leading-6 text-text-secondary">{opportunity.message}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={onCopy}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copiada' : 'Copiar mensagem'}
            </Button>
            <Button
              variant={opportunity.recoveryEligible ? 'secondary' : 'outline'}
              onClick={onDelegate}
              disabled={!opportunity.recoveryEligible}
            >
              <Bot size={15} />
              Passar para Recovery
            </Button>
            <Button variant="outline" onClick={onMarkDone}>
              <CheckCircle2 size={15} />
              Acao feita
            </Button>
            <Button variant="ghost" onClick={onDiscard}>
              <X size={15} />
              Descartar
            </Button>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <MiniFact label="Chance" value={percent(opportunity.confidence)} />
            <MiniFact label="Urgencia" value={opportunity.urgency} />
            <MiniFact label="Pessoas" value={String(opportunity.customers.length)} />
            <MiniFact label="Situacao" value={OPPORTUNITY_STATUS_LABELS[merged.record?.status ?? 'open']} />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-text-muted">Quem pode gerar esse dinheiro</p>
            <div className="space-y-2">
              {opportunity.customers.slice(0, 5).map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{customer.name}</p>
                    <p className="text-xs text-text-muted">
                      {daysBetween(customer.lastPurchaseDate)} dias sem voltar
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-medium text-status-success">
                    {formatCurrency(customer.approximateValue)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-4">
            <p className="font-medium text-text-primary">Registrar dinheiro recuperado</p>
            <p className="mt-1 text-xs text-text-muted">
              Feche o ciclo: acao feita, resposta registrada, dinheiro medido.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-text-secondary">Resultado</span>
                <select
                  value={resultDraft.result}
                  onChange={(event) =>
                    onResultDraftChange({ ...resultDraft, result: event.target.value as ResultStatus })
                  }
                  className="h-9 w-full rounded-lg border border-brand-border bg-brand-surface px-3 text-sm text-text-primary"
                >
                  {Object.entries(RESULT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Valor recuperado"
                placeholder={String(opportunity.estimatedValue)}
                value={resultDraft.recoveredValue}
                onChange={(event) =>
                  onResultDraftChange({ ...resultDraft, recoveredValue: event.target.value })
                }
                iconLeft={<Banknote size={15} />}
                inputMode="decimal"
              />
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-text-secondary">Observacao</span>
                <textarea
                  value={resultDraft.note}
                  onChange={(event) => onResultDraftChange({ ...resultDraft, note: event.target.value })}
                  placeholder="Ex.: respondeu no WhatsApp e agendou retorno para sexta."
                  className="min-h-20 w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                />
              </label>
              <Button variant="primary" className="w-full" onClick={onRegisterResult}>
                Registrar resultado
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}

function CustomersView(props: {
  company: Company;
  customers: Customer[];
  events: CustomerEvent[];
  selectedCustomer: Customer | null;
  customerForm: CustomerForm;
  eventForm: { type: EventType; date: string; value: string; note: string };
  onCustomerFormChange: (form: CustomerForm) => void;
  onEventFormChange: (form: { type: EventType; date: string; value: string; note: string }) => void;
  onAddCustomer: () => void;
  onAddDemoCustomers: () => void;
  onSelectCustomer: (id: string) => void;
  onAddEvent: (customerId: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-5">
        <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-text-primary">Adicionar a carteira</h3>
              <p className="text-xs text-text-muted">
                Informe so o que ajuda a achar retorno, recompra ou risco.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={props.onAddDemoCustomers}>
              <Sparkles size={14} />
              Carregar exemplo
            </Button>
          </div>

          <div className="grid gap-3">
            <Input
              label="Nome"
              value={props.customerForm.name}
              onChange={(event) => props.onCustomerFormChange({ ...props.customerForm, name: event.target.value })}
              placeholder="Nome da pessoa"
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="WhatsApp para recuperar"
                value={props.customerForm.phone}
                onChange={(event) => props.onCustomerFormChange({ ...props.customerForm, phone: event.target.value })}
                placeholder="11999999999"
                iconLeft={<MessageCircle size={15} />}
              />
              <Input
                label="Email opcional"
                value={props.customerForm.email}
                onChange={(event) => props.onCustomerFormChange({ ...props.customerForm, email: event.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Ultima compra ou visita"
                type="date"
                value={props.customerForm.lastPurchaseDate}
                onChange={(event) =>
                  props.onCustomerFormChange({ ...props.customerForm, lastPurchaseDate: event.target.value })
                }
              />
              <Input
                label="Valor aproximado"
                value={props.customerForm.approximateValue}
                onChange={(event) =>
                  props.onCustomerFormChange({ ...props.customerForm, approximateValue: event.target.value })
                }
                placeholder={String(props.company.averageTicket)}
                iconLeft={<Banknote size={15} />}
                inputMode="decimal"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Produto / servico"
                value={props.customerForm.offering}
                onChange={(event) => props.onCustomerFormChange({ ...props.customerForm, offering: event.target.value })}
                placeholder="Ex.: pacote mensal"
              />
              <Input
                label="Aniversario opcional"
                type="date"
                value={props.customerForm.birthday}
                onChange={(event) => props.onCustomerFormChange({ ...props.customerForm, birthday: event.target.value })}
                helper="Usado apenas para oportunidade de reaproximacao."
              />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={props.customerForm.contactPermission}
                onChange={(event) =>
                  props.onCustomerFormChange({ ...props.customerForm, contactPermission: event.target.checked })
                }
                className="h-4 w-4 rounded border-brand-border accent-brand-amber"
              />
              Permissao para recuperar registrada
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-secondary">Observacoes</span>
              <textarea
                value={props.customerForm.notes}
                onChange={(event) => props.onCustomerFormChange({ ...props.customerForm, notes: event.target.value })}
                placeholder="Contexto que ajuda a recuperar ou aumentar recorrencia."
                className="min-h-20 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
            </label>
            <Button variant="primary" onClick={props.onAddCustomer} disabled={!props.customerForm.name.trim()}>
              <Plus size={15} />
              Adicionar e procurar dinheiro
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-brand-border bg-brand-surface">
          <div className="border-b border-brand-border px-4 py-3">
            <h3 className="font-semibold text-text-primary">Carteira</h3>
            <p className="text-xs text-text-muted">A carteira existe so para alimentar oportunidades.</p>
          </div>
          {props.customers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted">
              Adicione pessoas para calcular dinheiro parado.
            </p>
          ) : (
            <div className="divide-y divide-brand-border">
              {props.customers.map((customer) => {
                const status = getCustomerStatus(customer, props.company);
                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => props.onSelectCustomer(customer.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-surface-2',
                      props.selectedCustomer?.id === customer.id && 'bg-brand-surface-2'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{customer.name}</p>
                      <p className="text-xs text-text-muted">
                        {customer.offering} · {daysBetween(customer.lastPurchaseDate)} dias sem voltar
                      </p>
                    </div>
                    <Badge variant={status.variant} size="sm" className="shrink-0">
                      {status.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <CustomerProfile
        customer={props.selectedCustomer}
        company={props.company}
        events={props.events}
        eventForm={props.eventForm}
        onEventFormChange={props.onEventFormChange}
        onAddEvent={props.onAddEvent}
      />
    </div>
  );
}

function CustomerProfile({
  customer,
  company,
  events,
  eventForm,
  onEventFormChange,
  onAddEvent,
}: {
  customer: Customer | null;
  company: Company;
  events: CustomerEvent[];
  eventForm: { type: EventType; date: string; value: string; note: string };
  onEventFormChange: (form: { type: EventType; date: string; value: string; note: string }) => void;
  onAddEvent: (customerId: string) => void;
}) {
  if (!customer) {
    return (
      <section className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <p className="text-sm text-text-muted">Selecione alguem da carteira para ver potencial e bloqueios.</p>
      </section>
    );
  }

  const customerEvents = events.filter((event) => event.customerId === customer.id);
  const status = getCustomerStatus(customer, company);

  return (
    <section className="rounded-lg border border-brand-border bg-brand-surface">
      <div className="border-b border-brand-border px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-text-primary">{customer.name}</h3>
              <Badge variant={status.variant} size="sm">
                {status.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-text-muted">{customer.offering}</p>
          </div>
          <p className="text-sm font-semibold text-status-success">{formatCurrency(customer.approximateValue)}</p>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <MiniFact label="WhatsApp para recuperar" value={customer.phone || 'faltando'} />
          <MiniFact label="Email" value={customer.email || 'opcional'} />
          <MiniFact label="Ultima compra ou visita" value={`${daysBetween(customer.lastPurchaseDate)} dias atras`} />
          <MiniFact label="Permissao para recuperar" value={customer.contactPermission ? 'registrada' : 'ausente'} />
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-text-muted">Observacoes</p>
            <p className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm leading-6 text-text-secondary">
              {customer.notes || 'Sem observacoes.'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-4">
            <p className="font-medium text-text-primary">Registrar sinal de dinheiro</p>
            <p className="mt-1 text-xs text-text-muted">
              Use quando algo muda a chance de retorno ou o dinheiro recuperado.
            </p>
            <div className="mt-4 grid gap-3">
              <label>
                <span className="mb-1 block text-xs font-medium text-text-secondary">Tipo</span>
                <select
                  value={eventForm.type}
                  onChange={(event) => onEventFormChange({ ...eventForm, type: event.target.value as EventType })}
                  className="h-9 w-full rounded-lg border border-brand-border bg-brand-surface px-3 text-sm text-text-primary"
                >
                  {Object.entries(EVENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Data"
                  type="date"
                  value={eventForm.date}
                  onChange={(event) => onEventFormChange({ ...eventForm, date: event.target.value })}
                />
                <Input
                  label="Valor se mudou"
                  value={eventForm.value}
                  onChange={(event) => onEventFormChange({ ...eventForm, value: event.target.value })}
                  inputMode="decimal"
                />
              </div>
              <Input
                label="Contexto"
                value={eventForm.note}
                onChange={(event) => onEventFormChange({ ...eventForm, note: event.target.value })}
                placeholder="Ex.: respondeu, visitou, comprou novamente..."
              />
              <Button variant="secondary" onClick={() => onAddEvent(customer.id)}>
                <History size={15} />
                Registrar sinal
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-text-muted">Sinais registrados</p>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {customerEvents.length === 0 ? (
                <p className="text-sm text-text-muted">Nenhum sinal registrado.</p>
              ) : (
                customerEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-brand-border bg-brand-surface-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-text-primary">{EVENT_LABELS[event.type]}</p>
                      <p className="text-xs text-text-muted">{new Date(`${event.date}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {event.note || 'Sem nota'} {event.value ? `· ${formatCurrency(event.value)}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmployeesView({
  recoveryActive,
  recoveryOpportunities,
  onActivateRecovery,
  onOpenOpportunity,
}: {
  recoveryActive: boolean;
  recoveryOpportunities: Opportunity[];
  onActivateRecovery: () => void;
  onOpenOpportunity: (id: string) => void;
}) {
  const potential = recoveryOpportunities.reduce((sum, opportunity) => sum + opportunity.estimatedValue, 0);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <Badge variant={recoveryActive ? 'success' : 'ai'} size="lg" dot={recoveryActive}>
              Primeiro Funcionario Virtual disponivel
            </Badge>
            <h3 className="mt-3 text-xl font-semibold text-text-primary">Recovery</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Missao: transformar pessoas paradas em retorno.
              Nesta versao ele nao envia mensagens automaticamente; recebe a oportunidade para
              provar o fluxo: dinheiro encontrado, Recovery acionado, resultado registrado.
            </p>
          </div>
          <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-4 lg:w-72">
            <p className="text-xs text-text-muted">Potencial compativel agora</p>
            <p className="mt-1 text-2xl font-semibold text-status-success">{formatCurrency(potential)}</p>
            <p className="mt-1 text-xs text-text-muted">
              {recoveryOpportunities.length} oportunidade(s) podem ser resolvidas pelo Recovery.
            </p>
            <Button variant="primary" className="mt-4 w-full" onClick={onActivateRecovery} disabled={recoveryOpportunities.length === 0}>
              <Bot size={15} />
              {recoveryActive ? 'Recovery trabalhando' : 'Colocar Recovery para trabalhar'}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-brand-border bg-brand-surface">
        <div className="border-b border-brand-border px-4 py-3">
          <h3 className="font-semibold text-text-primary">Dinheiro que o Recovery pode atacar</h3>
          <p className="text-xs text-text-muted">Mostra somente dinheiro ligado a pessoa parada, recompra ou alto valor sem contato.</p>
        </div>
        {recoveryOpportunities.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-muted">
            Nenhum dinheiro pronto para Recovery. Adicione uma carteira com ultima compra antiga ou perto do ciclo.
          </p>
        ) : (
          <div className="divide-y divide-brand-border">
            {recoveryOpportunities.map((opportunity) => (
              <button
                key={opportunity.id}
                type="button"
                onClick={() => onOpenOpportunity(opportunity.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-brand-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{opportunity.title}</p>
                  <p className="text-xs text-text-muted">{opportunity.recommendedAction}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-status-success">
                  {formatCurrency(opportunity.estimatedValue)}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ResultsView({
  ledger,
  opportunities,
  events,
  customers,
  recoveredRevenue,
}: {
  ledger: Record<string, OpportunityRecord>;
  opportunities: Opportunity[];
  events: CustomerEvent[];
  customers: Customer[];
  recoveredRevenue: number;
}) {
  const records = Object.values(ledger)
    // So exibe registros com lastro (id valido). Orfaos nunca aparecem na tela.
    .filter((record) => opportunityKindFromId(record.id))
    .filter((record) => record.result || record.status === 'delegated')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const returned = records.filter((record) => record.result === 'returned' || record.result === 'recovered').length;
  const noResponse = records.filter((record) => record.result === 'no_response').length;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3">
        <MoneyMetric
          icon={WalletCards}
          label="Receita recuperada"
          value={formatCurrency(recoveredRevenue)}
          sub="Informada manualmente"
          variant="success"
        />
        <MoneyMetric
          icon={CheckCircle2}
          label="Resultados positivos"
          value={String(returned)}
          sub="Voltou ou valor recuperado"
          variant="amber"
        />
        <MoneyMetric
          icon={Clock3}
          label="Sem resposta"
          value={String(noResponse)}
          sub="Aprendizado para proxima abordagem"
          variant="warning"
        />
      </section>

      <section className="rounded-lg border border-brand-border bg-brand-surface">
        <div className="border-b border-brand-border px-4 py-3">
          <h3 className="font-semibold text-text-primary">Resultado voltou para o dinheiro encontrado</h3>
          <p className="text-xs text-text-muted">
            Aqui voce prova se o dinheiro encontrado virou resposta, retorno ou receita.
          </p>
        </div>
        {records.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-muted">
            Nenhum resultado registrado ainda. Abra uma oportunidade e registre a resposta.
          </p>
        ) : (
          <div className="divide-y divide-brand-border">
            {records.map((record) => {
              const opportunity = opportunities.find((item) => item.id === record.id);
              // Titulo especifico da oportunidade ativa; se nao estiver ativa agora,
              // cai no titulo canonico do tipo — nunca no id interno.
              const kind = opportunityKindFromId(record.id);
              const recordTitle = opportunity?.title ?? (kind ? OPPORTUNITY_KIND_LABELS[kind] : 'Oportunidade');
              return (
                <div key={record.id} className="px-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-text-primary">{recordTitle}</p>
                        <Badge variant={record.status === 'delegated' ? 'ai' : record.status === 'discarded' ? 'default' : 'success'} size="sm">
                          {OPPORTUNITY_STATUS_LABELS[record.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-text-muted">
                        {record.result ? RESULT_LABELS[record.result] : 'Delegada ao Recovery'}
                        {record.resultNote ? ` · ${record.resultNote}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-status-success">
                      {record.recoveredValue ? formatCurrency(record.recoveredValue) : 'Sem valor'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-brand-border bg-brand-surface p-4">
        <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
          <span>{customers.length} pessoas na carteira local</span>
          <span className="text-text-muted">·</span>
          <span>{events.length} sinais registrados</span>
          <span className="text-text-muted">·</span>
          <span>{records.length} movimentos registrados</span>
        </div>
      </section>
    </div>
  );
}

function SettingsView({
  company,
  customersCount,
  eventsCount,
  onSaveCompany,
  onReset,
}: {
  company: Company;
  customersCount: number;
  eventsCount: number;
  onSaveCompany: (company: Company) => void;
  onReset: () => void;
}) {
  const [form, setForm] = useState({
    name: company.name,
    segment: company.segment,
    averageTicket: String(company.averageTicket),
    returnCycleDays: String(company.returnCycleDays),
    objective: company.objective,
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
      <section className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <h3 className="font-semibold text-text-primary">Ajustes que mudam o dinheiro encontrado</h3>
        <p className="mt-1 text-sm text-text-muted">
          Ticket e ciclo mudam quando o Connect considera alguem dinheiro parado.
        </p>
        <div className="mt-5 grid gap-4">
          <Input
            label="Nome da empresa"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="Segmento"
            value={form.segment}
            onChange={(event) => setForm({ ...form, segment: event.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Ticket medio"
              value={form.averageTicket}
              onChange={(event) => setForm({ ...form, averageTicket: event.target.value })}
              inputMode="decimal"
            />
            <Input
              label="Ciclo medio de retorno"
              value={form.returnCycleDays}
              onChange={(event) => setForm({ ...form, returnCycleDays: event.target.value })}
              inputMode="numeric"
            />
          </div>
          <label>
            <span className="mb-1 block text-xs font-medium text-text-secondary">Objetivo principal</span>
            <select
              value={form.objective}
              onChange={(event) => setForm({ ...form, objective: event.target.value as Objective })}
              className="h-9 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 text-sm text-text-primary"
            >
              {Object.entries(OBJECTIVE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="primary"
            onClick={() =>
              onSaveCompany({
                name: form.name.trim() || company.name,
                segment: form.segment.trim() || company.segment,
                averageTicket: parseMoney(form.averageTicket) || company.averageTicket,
                returnCycleDays: Math.max(1, Number(form.returnCycleDays) || company.returnCycleDays),
                objective: form.objective,
              })
            }
          >
            <Edit3 size={15} />
            Salvar calibragem
          </Button>
        </div>
      </section>

      <section className="space-y-5">
        <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 text-status-success" size={20} />
            <div>
              <h3 className="font-semibold text-text-primary">Dados desta demonstracao</h3>
              <p className="mt-1 text-sm leading-6 text-text-muted">
                Esta demonstracao guarda dados neste navegador. Nao ha backend, integracao externa,
                envio automatico ou marketplace.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniFact label="Carteira" value={String(customersCount)} />
            <MiniFact label="Sinais" value={String(eventsCount)} />
          </div>
        </div>

        <div className="rounded-lg border border-status-error/30 bg-status-error-muted p-5">
          <h3 className="font-semibold text-text-primary">Recomecar demonstracao</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Remove empresa, carteira, sinais, oportunidades e resultados deste navegador.
          </p>
          <Button variant="destructive" className="mt-4" onClick={onReset}>
            <Trash2 size={15} />
            Recomecar do zero
          </Button>
        </div>
      </section>
    </div>
  );
}

function NavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Target;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors lg:w-full',
        active
          ? 'bg-brand-surface-2 text-text-primary'
          : 'text-text-secondary hover:bg-brand-surface-2 hover:text-text-primary'
      )}
    >
      <Icon size={16} className={active ? 'text-brand-amber' : 'text-text-muted'} />
      {label}
    </button>
  );
}

function MoneyMetric({
  icon: Icon,
  label,
  value,
  sub,
  variant,
  featured = false,
  className,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  sub: string;
  variant: 'success' | 'amber' | 'warning' | 'info';
  featured?: boolean;
  className?: string;
}) {
  const color = {
    success: 'text-status-success bg-status-success-muted border-status-success/20',
    amber: 'text-brand-amber bg-brand-amber-subtle border-brand-amber/20',
    warning: 'text-status-warning bg-status-warning-muted border-status-warning/20',
    info: 'text-status-info bg-status-info-muted border-status-info/20',
  }[variant];

  return (
    <article
      className={cn(
        'rounded-lg border bg-brand-surface p-4 transition-colors',
        featured ? 'border-status-success/30 bg-status-success-muted/20 shadow-card' : 'border-brand-border',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-text-muted">{label}</p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', color)}>
          <Icon size={16} />
        </span>
      </div>
      <p className={cn('mt-3 font-semibold text-text-primary', featured ? 'text-3xl' : 'text-2xl')}>
        {value}
      </p>
      <p className={cn('mt-1 truncate-2 text-xs leading-5', featured ? 'text-text-secondary' : 'text-text-muted')}>
        {sub}
      </p>
    </article>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}

function ValuePill({ icon: Icon, title, text }: { icon: typeof Database; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
      <Icon size={18} className="text-brand-amber" />
      <p className="mt-3 text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-xs leading-5 text-text-muted">{text}</p>
    </div>
  );
}

function UrgencyBadge({ urgency }: { urgency: Opportunity['urgency'] }) {
  if (urgency === 'alta') return <Badge variant="error" size="sm">Urgencia alta</Badge>;
  if (urgency === 'media') return <Badge variant="warning" size="sm">Urgencia media</Badge>;
  return <Badge variant="default" size="sm">Urgencia baixa</Badge>;
}

function EmptyMoneyState({ onAddCustomer }: { onAddCustomer: () => void }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-brand-border bg-brand-surface-2">
        <Search size={20} className="text-brand-amber" />
      </div>
      <h3 className="mt-4 font-semibold text-text-primary">Ainda nao encontrei dinheiro parado</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
        Adicione algumas pessoas com ultima compra, valor e permissao. O Connect mostra quem
        atrasou, quem esta perto de recomprar e onde existe dinheiro parado.
      </p>
      <Button variant="primary" className="mt-5" onClick={onAddCustomer}>
        <Plus size={15} />
        Adicionar pessoa da carteira
      </Button>
    </div>
  );
}
