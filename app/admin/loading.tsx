export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        width: "100%",
        background: "var(--color-background, #F8FAFC)",
        color: "var(--color-text-primary, #0F172A)",
        fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "36px 44px",
          borderRadius: "24px",
          background: "var(--color-surface, rgba(255, 255, 255, 0.9))",
          border: "1px solid var(--color-border, #E2E8F0)",
          boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08), 0 0 30px rgba(37, 99, 235, 0.08)",
          textAlign: "center",
          maxWidth: "360px",
        }}
      >
        {/* Animated Double Orbital Ring with CreditWise Shield */}
        <div
          style={{
            position: "relative",
            width: "72px",
            height: "72px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Outer gradient rotating ring */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "3.5px solid transparent",
              borderTopColor: "#2563EB",
              borderRightColor: "#14B8A6",
              animation: "creditwisePageSpin 1.1s linear infinite",
            }}
          />
          {/* Inner counter-rotating ring */}
          <div
            style={{
              position: "absolute",
              inset: "7px",
              borderRadius: "50%",
              border: "2px dashed rgba(37, 99, 235, 0.4)",
              animation: "creditwisePageSpinReverse 1.8s linear infinite",
            }}
          />
          {/* Center Brand Badge */}
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
              animation: "creditwisePagePulse 1.6s ease-in-out infinite",
            }}
          >
            <i
              className="bi bi-shield-check"
              style={{
                color: "#FFFFFF",
                fontSize: "20px",
              }}
            />
          </div>
        </div>

        {/* Brand Title */}
        <div
          style={{
            fontSize: "17px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: "6px",
          }}
        >
          CreditWise AI
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "13px",
            color: "var(--color-text-muted, #64748B)",
            marginBottom: "16px",
          }}
        >
          Preparing your financial workspace...
        </div>

        {/* Shimmering Progress Indicator */}
        <div
          style={{
            width: "160px",
            height: "4px",
            borderRadius: "999px",
            backgroundColor: "rgba(37, 99, 235, 0.12)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "45%",
              background: "linear-gradient(90deg, #2563EB, #14B8A6)",
              borderRadius: "999px",
              animation: "creditwisePageShimmer 1.4s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes creditwisePageSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes creditwisePageSpinReverse {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes creditwisePagePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes creditwisePageShimmer {
          0% { left: -45%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
