import AgentServerClient from "./AgentServerClient";

export const metadata = {
  title: "AI-analyysi",
  description: "Agent V11:n palvelimella laskettu Model Lab, varmennettu urheilukonteksti ja virtuaalinen paperiportfolio."
};

export default function AgentPage() {
  return <AgentServerClient />;
}
