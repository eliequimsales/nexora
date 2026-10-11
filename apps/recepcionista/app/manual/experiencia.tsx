"use client";

import { useEffect, useState } from "react";
import styles from "./manual.module.css";

export function ConversaExemplo() {
  const [repeticao, setRepeticao] = useState(0);

  return (
    <div className={styles.demoWrap}>
      <div className={styles.demoCaption}>
        <span /> À noite. No domingo. No meio do atendimento.
      </div>
      <div className={styles.phone}>
        <div className={styles.phoneStatus}>
          <span>22:14</span>
          <span aria-hidden="true">▂▄▆ ▰</span>
        </div>
        <div className={styles.chatHeader}>
          <span className={styles.chatAvatar} aria-hidden="true">
            N
          </span>
          <div>
            <strong>Sua empresa</strong>
            <span>Exemplo de atendimento</span>
          </div>
          <span className={styles.chatMenu} aria-hidden="true">
            •••
          </span>
        </div>
        <div className={styles.chatBody} key={repeticao}>
          <span className={styles.chatDay}>DOMINGO</span>
          <div className={styles.incoming}>
            Boa noite! Quanto custa o procedimento? Tem horário para amanhã?
            <span>22:14</span>
          </div>
          <div className={styles.outgoing}>
            Oi! Me conta qual procedimento você procura? Assim, confiro o valor
            e os horários para você.
            <span>
              22:14 <b aria-label="Mensagem lida">✓✓</b>
            </span>
          </div>
          <div className={styles.incomingLast}>
            Limpeza de pele. De manhã seria ótimo!<span>22:14</span>
          </div>
          <div className={styles.chatOutcome}>
            <span aria-hidden="true">✓</span> A conversa continua.
            <br />
            <strong>O cliente se sente atendido.</strong>
          </div>
        </div>
        <div className={styles.chatInput} aria-hidden="true">
          <span>Mensagem</span>
          <span>➤</span>
        </div>
      </div>
      <div className={styles.demoFooter}>
        <span>Conversa ilustrativa. Nenhuma mensagem é enviada.</span>
        <button
          type="button"
          onClick={() => setRepeticao((valor) => valor + 1)}
        >
          ↻ Ver de novo
        </button>
      </div>
    </div>
  );
}

export function BarraCompraMobile() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const inicio = document.getElementById("acao-inicial");
    const oferta = document.getElementById("oferta");
    if (!inicio || !oferta) return;
    const atualizar = () => {
      const fimDoInicio = inicio.getBoundingClientRect().bottom;
      const caixaOferta = oferta.getBoundingClientRect();
      const ofertaNaTela =
        caixaOferta.top < window.innerHeight && caixaOferta.bottom > 0;
      setVisivel(fimDoInicio < 0 && !ofertaNaTela);
    };
    atualizar();
    window.addEventListener("scroll", atualizar, { passive: true });
    window.addEventListener("resize", atualizar);
    return () => {
      window.removeEventListener("scroll", atualizar);
      window.removeEventListener("resize", atualizar);
    };
  }, []);

  if (!visivel) return null;
  return (
    <aside className={styles.mobileBar} aria-label="Oferta do guia">
      <div>
        <strong>
          R$ 27<span>,00</span>
        </strong>
        <small>Pagamento único</small>
      </div>
      <a href="#oferta" className={styles.button}>
        Quero meu guia <span aria-hidden="true">↗</span>
      </a>
    </aside>
  );
}
