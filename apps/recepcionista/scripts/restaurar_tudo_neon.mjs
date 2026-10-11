import { PrismaClient } from '@nexora/recepcionista-prisma';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

function toDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const backupPath = path.resolve(process.cwd(), '../../backup_producao_completo.json');
  console.log('📖 Lendo arquivo de backup:', backupPath);
  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  console.log(`🚀 Iniciando restauração completa de ${data.totalEmpresas} empresas no Neon...`);

  let totalCompanies = 0;
  let totalProfiles = 0;
  let totalServices = 0;
  let totalGaps = 0;
  let totalKnowledge = 0;
  let totalCustomers = 0;
  let totalConversations = 0;
  let totalMessages = 0;
  let totalAppointments = 0;
  let totalLeads = 0;

  for (const c of data.companies) {
    const {
      profile,
      services,
      knowledgeItems,
      knowledgeGaps,
      conversations,
      customers,
      appointments,
      leads,
      passes,
      ...rawCompany
    } = c;

    // 1. Company
    const companyData = {
      ...rawCompany,
      createdAt: toDate(rawCompany.createdAt) || new Date(),
      updatedAt: toDate(rawCompany.updatedAt) || new Date(),
      currentPeriodEnd: toDate(rawCompany.currentPeriodEnd),
      trialEndsAt: toDate(rawCompany.trialEndsAt),
      acessoPagoAte: toDate(rawCompany.acessoPagoAte),
      primeiraOndaEm: toDate(rawCompany.primeiraOndaEm),
      dunningIniciadoEm: toDate(rawCompany.dunningIniciadoEm),
      checkoutAbertoEm: toDate(rawCompany.checkoutAbertoEm),
      canceladoEm: toDate(rawCompany.canceladoEm),
      reguaAvaliadaEm: toDate(rawCompany.reguaAvaliadaEm),
      termosAceitosEm: toDate(rawCompany.termosAceitosEm),
      confirmacaoEnviadaEm: toDate(rawCompany.confirmacaoEnviadaEm),
      emailVerificadoEm: toDate(rawCompany.emailVerificadoEm)
    };

    await prisma.company.upsert({
      where: { id: c.id },
      create: companyData,
      update: companyData,
    });
    totalCompanies++;

    // 2. Profile (CompanyProfile)
    if (profile) {
      const profileData = {
        ...profile,
        companyId: c.id,
        interviewStartedAt: toDate(profile.interviewStartedAt),
        atendenteTestadoEm: toDate(profile.atendenteTestadoEm),
        atendenteLigadoPrimeiraVezEm: toDate(profile.atendenteLigadoPrimeiraVezEm),
        whatsappConnectedAt: toDate(profile.whatsappConnectedAt)
      };
      await prisma.companyProfile.upsert({
        where: { companyId: c.id },
        create: profileData,
        update: profileData,
      });
      totalProfiles++;
    }

    // 3. Serviços
    if (services && services.length > 0) {
      for (const s of services) {
        const serviceData = {
          ...s,
          companyId: c.id
        };
        await prisma.service.upsert({
          where: { id: s.id },
          create: serviceData,
          update: serviceData,
        });
        totalServices++;
      }
    }

    // 4. Knowledge Gaps
    if (knowledgeGaps && knowledgeGaps.length > 0) {
      for (const g of knowledgeGaps) {
        const { resolvedAt, ...gapClean } = g;
        const gapData = {
          ...gapClean,
          companyId: c.id,
          lastAskedAt: toDate(gapClean.lastAskedAt) || new Date(),
          createdAt: toDate(gapClean.createdAt) || new Date()
        };
        await prisma.knowledgeGap.upsert({
          where: { id: g.id },
          create: gapData,
          update: gapData,
        });
        totalGaps++;
      }
    }

    // 5. Knowledge Items
    if (knowledgeItems && knowledgeItems.length > 0) {
      for (const k of knowledgeItems) {
        const itemData = {
          ...k,
          companyId: c.id,
          createdAt: toDate(k.createdAt) || new Date(),
          approvedAt: toDate(k.approvedAt)
        };
        await prisma.knowledgeItem.upsert({
          where: { id: k.id },
          create: itemData,
          update: itemData,
        });
        totalKnowledge++;
      }
    }

    // 6. Customers
    if (customers && customers.length > 0) {
      for (const cust of customers) {
        const custData = {
          ...cust,
          companyId: c.id,
          createdAt: toDate(cust.createdAt) || new Date(),
          updatedAt: toDate(cust.updatedAt) || new Date(),
          optOutAt: toDate(cust.optOutAt)
        };
        await prisma.customer.upsert({
          where: { id: cust.id },
          create: custData,
          update: custData,
        });
        totalCustomers++;
      }
    }

    // 7. Conversations + Messages
    if (conversations && conversations.length > 0) {
      for (const conv of conversations) {
        const { messages, ...rawConv } = conv;
        const convData = {
          ...rawConv,
          companyId: c.id,
          createdAt: toDate(rawConv.createdAt) || new Date(),
          updatedAt: toDate(rawConv.updatedAt) || new Date(),
          lastCustomerMessageAt: toDate(rawConv.lastCustomerMessageAt),
          lastFollowUpAt: toDate(rawConv.lastFollowUpAt),
          donoAssumiuEm: toDate(rawConv.donoAssumiuEm)
        };

        await prisma.conversation.upsert({
          where: { id: conv.id },
          create: convData,
          update: convData,
        });
        totalConversations++;

        if (messages && messages.length > 0) {
          for (const m of messages) {
            const msgData = {
              ...m,
              conversationId: conv.id,
              createdAt: toDate(m.createdAt) || new Date()
            };
            await prisma.message.upsert({
              where: { id: m.id },
              create: msgData,
              update: msgData,
            });
            totalMessages++;
          }
        }
      }
    }

    // 8. Appointments
    if (appointments && appointments.length > 0) {
      for (const a of appointments) {
        const apptData = {
          ...a,
          companyId: c.id,
          startsAt: toDate(a.startsAt) || new Date(),
          endsAt: toDate(a.endsAt) || new Date(),
          createdAt: toDate(a.createdAt) || new Date(),
          updatedAt: toDate(a.updatedAt) || new Date()
        };
        await prisma.appointment.upsert({
          where: { id: a.id },
          create: apptData,
          update: apptData,
        });
        totalAppointments++;
      }
    }

    // 9. Leads
    if (leads && leads.length > 0) {
      for (const l of leads) {
        const leadData = {
          ...l,
          companyId: c.id,
          createdAt: toDate(l.createdAt) || new Date()
        };
        await prisma.lead.upsert({
          where: { id: l.id },
          create: leadData,
          update: leadData,
        });
        totalLeads++;
      }
    }

    console.log(`✔ [${totalCompanies}/32] Restaurada: ${c.name} (${c.id})`);
  }

  console.log('\n====================================');
  console.log('🎉 RESTAURAÇÃO COMPLETA COM SUCESSO NO NEON:');
  console.log(`- Empresas: ${totalCompanies}`);
  console.log(`- Perfis: ${totalProfiles}`);
  console.log(`- Serviços: ${totalServices}`);
  console.log(`- Itens de Conhecimento: ${totalKnowledge}`);
  console.log(`- Gaps de Conhecimento: ${totalGaps}`);
  console.log(`- Clientes: ${totalCustomers}`);
  console.log(`- Conversas: ${totalConversations}`);
  console.log(`- Mensagens: ${totalMessages}`);
  console.log(`- Agendamentos: ${totalAppointments}`);
  console.log(`- Leads: ${totalLeads}`);
  console.log('====================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Erro na restauração:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
