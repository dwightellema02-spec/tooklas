import React, { useEffect, useRef, useState } from "react";
import { Youtube, ExternalLink, ShieldCheck, Sparkles, Play } from "lucide-react";
import { YOUTUBE_CONFIG } from "@/config/youtube";
import { parseYouTubeUrl } from "@/lib/youtube/youtube-parser";

export interface YouTubeVideoProps {
  videoId?: string;
  url?: string;
  title?: string;
  channelName?: string;
  description?: string;
  onVideoOpened?: () => void;
  /** Called once when the video plays to its end. */
  onEnded?: () => void;
  className?: string;
  compact?: boolean;
}

export function YouTubeVideo({
  videoId: initialVideoId,
  url,
  title = "Mathisipan Educational Video",
  channelName = "Mathisipan",
  description,
  onVideoOpened,
  onEnded,
  className = "",
  compact = false,
}: YouTubeVideoProps) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  // The embedded player reports its state to the page once it is asked to (enablejsapi=1 and a "listening" message), so the
  // end of the video can be seen without loading YouTube's script, which the page's content-security policy does not allow.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow || typeof e.data !== "string") return;
      try {
        const d = JSON.parse(e.data);
        if ((d.event === "onStateChange" && d.info === 0) || (d.event === "infoDelivery" && d.info?.playerState === 0)) {
          endedRef.current?.();
        }
      } catch {
        /* not a player message */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Resolve videoId either from prop or by parsing url
  let resolvedVideoId = initialVideoId;
  if (!resolvedVideoId && url) {
    const parsed = parseYouTubeUrl(url);
    if (parsed.isValid && parsed.videoId) {
      resolvedVideoId = parsed.videoId;
    }
  }

  if (!resolvedVideoId) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
        No valid YouTube video ID provided.
      </div>
    );
  }

  const embedUrl = `${YOUTUBE_CONFIG.mathisipan.embedBaseUrl}/${resolvedVideoId}?rel=0&modestbranding=1&enablejsapi=1`;
  const canonicalWatchUrl = `${YOUTUBE_CONFIG.mathisipan.youtubeBaseUrl}/watch?v=${resolvedVideoId}`;

  const handleInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      if (onVideoOpened) {
        onVideoOpened();
      }
    }
  };

  return (
    <div
      className={`bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs space-y-3 p-4 sm:p-5 ${className}`}
      onClick={handleInteraction}
    >
      {/* Video Attribution Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 shadow-2xs">
            <Youtube className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
                {channelName.toLowerCase().includes("math")
                  ? "Mathisipan / Math Isip Concept Video"
                  : "Curated Educational Video"}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                MATATAG Aligned
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-1">
              {title}
            </h3>
          </div>
        </div>

        {/* Official External Link */}
        <a
          href={canonicalWatchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80 transition-colors shrink-0"
          aria-label={`Watch ${title} on official YouTube platform`}
        >
          <span>Watch on YouTube</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Embedded Video Player Container */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 shadow-inner border border-slate-900/10">
        <iframe
          ref={frameRef}
          onLoad={() => frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*")}
          src={embedUrl}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="w-full h-full border-0"
        />
      </div>

      {/* Footer / Attribution Notice */}
      {!compact && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {YOUTUBE_CONFIG.mathisipan.attributionLabel} • Hosted by YouTube
            </span>
          </div>
          <div className="flex items-center gap-2">
            {description && (
              <p className="text-slate-600 line-clamp-2 max-w-md">
                {description}
              </p>
            )}
            <a
              href={canonicalWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 hover:underline font-semibold inline-flex items-center gap-1 shrink-0 ml-auto sm:ml-0"
            >
              <span>Can't play? Watch on YouTube</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
