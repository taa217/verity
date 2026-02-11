import { useEffect, useMemo, useRef } from "react";
import * as React from "react";
import * as ReactLive from "react-live";
import { motion, AnimatePresence } from "framer-motion";

import { toReactLiveSnippet } from "../utils/aiCodeTransform";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface NativeCodeRendererProps {
  code: string;
  showCode?: boolean;
  /** Called when a RUNTIME error occurs in the preview */
  onCodeError?: (error: string, code: string) => void;
  /** Called when the preview renders cleanly */
  onReady?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getErrorSignature(error: string, code: string): string {
  return `${error.slice(0, 200)}::${code.length}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function NativeCodeRenderer({
  code,
  showCode = false,
  onCodeError,
  onReady,
}: NativeCodeRendererProps) {
  const hasCalledOnReadyRef = useRef(false);
  const lastErrorSignatureRef = useRef<string | null>(null);

  const liveCode = useMemo(() => toReactLiveSnippet(code), [code]);

  // Minimal scope — only what SVG + framer-motion lessons need.
  const scope = useMemo(
    () => ({
      // React core
      React,
      useState: React.useState,
      useEffect: React.useEffect,
      useMemo: React.useMemo,
      useRef: React.useRef,
      useCallback: React.useCallback,
      useLayoutEffect: React.useLayoutEffect,

      // Animation
      motion,
      AnimatePresence,
    }),
    [],
  );

  // react-live components (loosely typed for safety)
  const LiveProvider = (ReactLive as any).LiveProvider as React.ComponentType<any>;
  const LivePreview = (ReactLive as any).LivePreview as React.ComponentType<any>;
  const LiveError = (ReactLive as any).LiveError as React.ComponentType<any>;
  const LiveContext = (ReactLive as any).LiveContext as React.Context<any> | undefined;

  // Reset dedup refs when code changes
  useEffect(() => {
    lastErrorSignatureRef.current = null;
    hasCalledOnReadyRef.current = false;
  }, [code]);

  // ------ Inner component (must live inside LiveProvider tree) ------
  function LiveStatus() {
    if (!LiveContext) return null;

    const liveState = React.useContext(LiveContext);
    const liveError: string | null =
      (liveState && (liveState.error as string)) || null;

    // Notify parent on first clean render
    useEffect(() => {
      if (!onReady || hasCalledOnReadyRef.current) return;
      if (liveError) return;
      hasCalledOnReadyRef.current = true;
      onReady();
    }, [liveError]);

    // Forward errors to parent for auto-fix
    useEffect(() => {
      if (!onCodeError || !liveError) return;
      const sig = getErrorSignature(liveError, code);
      if (lastErrorSignatureRef.current === sig) return;
      lastErrorSignatureRef.current = sig;
      onCodeError(liveError, code);
    }, [liveError]);

    return liveError ? (
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 12,
          maxHeight: "40%",
          overflow: "auto",
          background: "rgba(15,16,32,0.92)",
          border: "1px solid rgba(42,43,74,0.9)",
          borderRadius: 10,
          padding: 12,
          color: "#c7c7d1",
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, color: "#ffb4b4" }}>
          Preview error
        </div>
        <LiveError />
      </div>
    ) : null;
  }

  // ------ Render ------
  const isMobile = window.innerWidth <= 768;

  return (
    <div
      className="code-renderer"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: isMobile && showCode ? "column" : "row",
        background: "#0c0f14",
      }}
    >
      {/* Optional code panel */}
      {showCode && (
        <div
          className="code-renderer__source"
          style={{
            width: isMobile ? "100%" : "42%",
            height: isMobile ? "35%" : "100%",
            borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.08)",
            borderBottom: isMobile ? "1px solid rgba(255,255,255,0.08)" : "none",
            overflow: "auto",
            background: "#0d1117",
            flexShrink: 0,
          }}
        >
          <pre
            style={{
              margin: 0,
              padding: isMobile ? 12 : 16,
              fontSize: isMobile ? 11 : 13,
              lineHeight: 1.6,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              color: "#c9d1d9",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {code}
          </pre>
        </div>
      )}

      {/* Live preview */}
      <div
        className="code-renderer__preview"
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
          background: "#0c0f14",
        }}
      >
        <LiveProvider code={liveCode} scope={scope} noInline>
          <div style={{ width: "100%", height: "100%" }}>
            <LivePreview style={{ width: "100%", height: "100%" }} />
          </div>
          <LiveStatus />
        </LiveProvider>
      </div>
    </div>
  );
}
