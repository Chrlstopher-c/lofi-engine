/** Journalisation du centre de contrôle. */
import pino from "pino";

export const journal = pino({
  level: process.env.NIVEAU_JOURNAL ?? "info",
  transport: process.env.NODE_ENV === "production"
    ? undefined
    : { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
});
