"use client";

import React, { useEffect, useMemo, useState } from "react";

// ==============================================================================
// BEEEJOY Typewriter Text
// Types a rotating list of phrases behind a blinking caret. The container
// reserves the width/height of the longest phrase so typing never shifts layout.
// ==============================================================================

type Phase = "typing" | "pausing" | "deleting";

interface TypewriterTextProps {
  phrases: string[];
  enabled?: boolean;
  cursor?: boolean;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  className?: string;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

export default function TypewriterText({
  phrases,
  enabled = true,
  cursor = true,
  typingSpeed = 65,
  deletingSpeed = 35,
  pauseDuration = 1800,
  className = "",
}: TypewriterTextProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  // A stable key keeps effects from restarting on every parent render.
  const sequenceKey = useMemo(
    () => (phrases.length ? phrases.join("\u0000") : ""),
    [phrases]
  );
  const sequence = useMemo(
    () => (sequenceKey ? sequenceKey.split("\u0000") : [""]),
    [sequenceKey]
  );

  const animated =
    enabled && !prefersReducedMotion && sequenceKey.length > 0;

  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");

  // Restart cleanly whenever the phrases or the animation switches change.
  useEffect(() => {
    setIndex(0);
    setPhase("typing");
    setText(animated ? "" : sequence[0] || "");
  }, [sequenceKey, animated, sequence]);

  useEffect(() => {
    if (!animated) return;

    const current = sequence[index % sequence.length] ?? "";
    let timer: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (text.length < current.length) {
        timer = setTimeout(
          () => setText(current.slice(0, text.length + 1)),
          typingSpeed
        );
      } else {
        timer = setTimeout(() => setPhase("pausing"), pauseDuration);
      }
    } else if (phase === "pausing") {
      timer = setTimeout(
        () => setPhase("deleting"),
        Math.min(700, Math.round(pauseDuration / 3))
      );
    } else if (text.length > 0) {
      timer = setTimeout(
        () => setText(current.slice(0, text.length - 1)),
        deletingSpeed
      );
    } else {
      // Move to the next phrase (or restart when only one is configured).
      timer = setTimeout(() => {
        if (sequence.length > 1) {
          setIndex((prev) => (prev + 1) % sequence.length);
        }
        setPhase("typing");
      }, 320);
    }

    return () => clearTimeout(timer);
  }, [
    animated,
    phase,
    text,
    index,
    sequence,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
  ]);

  const showCursor = animated && cursor;
  const visible = animated ? text : sequence[0] || "";

  return (
    <span className="relative inline-grid max-w-full align-baseline">
      {/* Invisible sizers: keep the block sized for the longest phrase so the
          hero never reflows while typing or deleting. */}
      {sequence.map((phrase, sizerIndex) => (
        <span
          key={`sizer-${sizerIndex}`}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1"
        >
          {phrase || "\u00A0"}
        </span>
      ))}

      <span className="col-start-1 row-start-1">
        <span className={className} aria-hidden={animated || undefined}>
          {visible}
        </span>
        {showCursor && <span className="typewriter-cursor" aria-hidden="true" />}
      </span>

      {/* Animated text changes constantly, so expose the first phrase instead. */}
      {animated && <span className="sr-only">{sequence[0]}</span>}
    </span>
  );
}
