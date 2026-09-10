import { TemaNexora } from "@/components/tema-nexora";

// Funil público: esta tela usa o visual da Nexora antiga (components/tema-nexora.tsx).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TemaNexora>{children}</TemaNexora>;
}
