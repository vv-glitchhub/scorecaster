export default function manifest() {
  return {
    name: "Scorecaster",
    short_name: "Scorecaster",
    description: "Sports decision intelligence, risk control and virtual paper tracking.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07090f",
    theme_color: "#07090f",
    orientation: "portrait-primary",
    categories: ["sports", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
    ]
  };
}
