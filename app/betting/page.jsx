import BettingClient from "./BettingClient";

export const metadata = {
  title: "Kohteet",
  description: "Vertaa urheilumarkkinan kertoimia, edgeä, EV:tä ja datan laatua paperiseurantaa varten."
};

export default function BettingPage() {
  return <BettingClient />;
}
