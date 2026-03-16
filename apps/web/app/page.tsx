import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <span className="text-xl font-bold text-foreground">TokenLens</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            AI Cost Intelligence
            <br />
            <span className="text-primary">for Engineering Teams</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Track every token across OpenAI, Anthropic, AWS Bedrock, and Google
            Vertex AI. Break down costs by feature, team, and model. Get
            AI-powered optimization recommendations.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="https://docs.tokenlens.dev"
              className="rounded-lg border border-border px-6 py-3 text-base font-semibold text-foreground hover:bg-accent transition-colors"
            >
              Documentation
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            {
              title: "Multi-Provider Tracking",
              description:
                "Unified view across OpenAI, Anthropic, AWS Bedrock, Google Vertex AI, and Azure OpenAI.",
            },
            {
              title: "Cost Attribution",
              description:
                "Tag LLM calls by feature, team, and user. Know exactly where every dollar goes.",
            },
            {
              title: "Smart Optimization",
              description:
                "AI-powered recommendations to route tasks to cheaper models without quality loss.",
            },
            {
              title: "Budget Alerts",
              description:
                "Set spend thresholds and get notified via Slack or email before costs spiral.",
            },
            {
              title: "Anomaly Detection",
              description:
                "Automatic detection of cost spikes and unusual usage patterns.",
            },
            {
              title: "Weekly Reports",
              description:
                "Auto-generated cost summaries with trends, top spenders, and savings opportunities.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6"
            >
              <h3 className="text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto max-w-7xl text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} TokenLens. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
