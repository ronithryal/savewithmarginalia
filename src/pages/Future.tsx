import { Globe, BrainCircuit, Newspaper, BarChart2, Sparkles, Users, Search } from "lucide-react";
import { motion } from "framer-motion";

const sections = [
  {
    icon: Globe,
    label: "CAPTURE",
    heading: "Save from anywhere — without leaving the page.",
    body: "A browser extension and mobile app that let you save articles and highlight quotes directly from the source, with one click. No tab switching. No copy-paste. The moment of interest is where the save should happen.",
  },
  {
    icon: BrainCircuit,
    label: "INTELLIGENCE",
    heading: "Smarter AI. Better thinking.",
    body: "The current AI chat runs on a single model. The next version routes through OpenRouter — giving you access to Claude, GPT-4o, and Gemini Ultra depending on the depth of thinking you need. Your library deserves the best reasoning available.",
  },
  {
    icon: Newspaper,
    label: "DIGEST",
    heading: "Your week in ideas, written for you.",
    body: "Every week, Marginalia reads everything you saved and writes you a personal digest — what connected, what conflicted, what it says about what you're thinking about. Three reading recommendations for the week ahead, grounded in your actual library, not a generic algorithm.",
  },
  {
    icon: BarChart2,
    label: "ANALYTICS",
    heading: "Understand your own intellectual habits.",
    body: "A reading analytics dashboard that maps your tag frequency over time, tracks your source diversity, surfaces knowledge gaps in the topics you follow, and detects when your interests are shifting — before you've consciously noticed.",
  },
  {
    icon: Sparkles,
    label: "WRAPPED",
    heading: "Your reading year, made visible.",
    body: "An annual summary of your intellectual life — your top ideas, most-cited sources, most-highlighted quotes, and how your interests evolved month by month. Shareable. Personal. The artifact of a year spent reading seriously.",
  },
  {
    icon: Users,
    label: "COMMUNITY",
    heading: "Make your library public. Follow great readers.",
    body: "Public reading profiles — a shareable URL that shows what you've saved, organized by tag. Follow other readers whose taste you trust. Save their articles directly into your own library. Your curation, visible to the world.",
  },
  {
    icon: Search,
    label: "DISCOVERY",
    heading: "Find what you didn't know to look for.",
    body: "A semantic discovery layer built on vector embeddings of your entire library. Instead of matching keywords, Marginalia finds external content that is meaningfully similar to what you've already saved — surfacing the article you didn't know existed but would immediately recognize as essential.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0, 0, 0.2, 1] as const } },
};

const Future = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Header */}
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeUp}>
        <p className="text-xs tracking-widest text-muted-foreground uppercase mb-4">
          WHAT'S NEXT
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
          The library that grows with you.
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mb-12">
          Marginalia today captures what you read and helps you think with it.
          Everything below is where it goes next — turning your reading habit into
          compounding intellectual capital.
        </p>
      </motion.div>

      <div className="border-t border-border" />

      {/* Feature sections */}
      {sections.map((section, i) => (
        <div key={section.label}>
          <motion.div
            className="flex flex-col sm:flex-row gap-8 py-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={{
              hidden: { opacity: 0, y: 24 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0, 0, 0.2, 1] as const, delay: 0.05 } },
            }}
          >
            <section.icon
              className="text-muted-foreground flex-shrink-0"
              size={48}
              strokeWidth={1.5}
            />
            <div>
              <p className="text-xs tracking-widest text-muted-foreground uppercase mb-2">
                {section.label}
              </p>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                {section.heading}
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed max-w-prose">
                {section.body}
              </p>
            </div>
          </motion.div>
          <div className="border-t border-border" />
        </div>
      ))}

      {/* Closing block */}
      <motion.div
        className="pt-16 pb-12"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={fadeUp}
      >
        <p className="text-xs tracking-widest text-muted-foreground uppercase mb-4">
          THE THESIS
        </p>
        <blockquote className="text-2xl font-normal italic text-foreground leading-snug max-w-2xl">
          "The user who reads with Marginalia doesn't just have more saved.
          They know more — thoroughly, connectedly, and over time."
        </blockquote>
      </motion.div>
    </div>
  );
};

export default Future;
