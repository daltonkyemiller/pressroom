import { cn } from "@/lib/utils";

const shimmerClasses =
  "animate-shimmer [will-change:background-position] bg-[length:300%_300%] bg-[linear-gradient(var(--shimmer-angle,90deg),var(--color-skeleton)_33%,var(--color-skeleton-highlight)_50%,var(--color-skeleton)_66%)]";

const pulseClasses = "bg-skeleton animate-pulse";

type SkeletonStyle = React.CSSProperties & {
  "--shimmer-angle"?: string;
  "--shimmer-direction"?: string;
  "--shimmer-duration"?: string;
};

interface SkeletonProps extends React.ComponentProps<"div"> {
  shimmer?: boolean;
  durationMs?: number;
  angle?: number;
}

function Skeleton({
  className,
  children,
  shimmer = true,
  durationMs,
  angle,
  style,
  ...props
}: SkeletonProps) {
  const animationClasses = shimmer ? shimmerClasses : pulseClasses;
  const cssVars: SkeletonStyle = {};

  if (shimmer && durationMs) {
    cssVars["--shimmer-duration"] = `${durationMs}ms`;
  }

  if (shimmer && angle !== undefined) {
    cssVars["--shimmer-angle"] = `${angle}deg`;
    if (angle > 180 && angle < 360) {
      cssVars["--shimmer-direction"] = "reverse";
    }
  }

  const mergedStyle: SkeletonStyle = { ...style, ...cssVars };

  if (children) {
    return (
      <span
        className={cn(
          animationClasses,
          "rounded-sm text-transparent select-none box-decoration-clone",
          className,
        )}
        style={mergedStyle}
        {...props}
      >
        {children}
      </span>
    );
  }

  return (
    <div
      data-slot="skeleton"
      className={cn(animationClasses, "rounded-lg", className)}
      style={mergedStyle}
      {...props}
    />
  );
}

export { Skeleton };
