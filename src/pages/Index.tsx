import { useState, useRef, useCallback } from "react";
import heroBg from "@/assets/hero-bg.jpg";

type AppState = "idle" | "uploaded" | "paying" | "analyzing" | "result";

interface AnalysisResult {
  score: number;
  celebrity: string;
  similarity: number;
  description: string;
  dynasty: string;
}

const MOCK_RESULTS: AnalysisResult[] = [
  { score: 87, celebrity: "王昭君", similarity: 82, description: "汉朝四大美女之一，以和亲出塞闻名。", dynasty: "西汉" },
  { score: 91, celebrity: "李白", similarity: 75, description: "唐代伟大浪漫主义诗人，诗仙之称。", dynasty: "唐代" },
  { score: 83, celebrity: "武则天", similarity: 78, description: "中国历史上唯一的正统女皇帝。", dynasty: "唐代" },
  { score: 79, celebrity: "曹操", similarity: 70, description: "东汉末年政治家、军事家、文学家。", dynasty: "三国" },
  { score: 88, celebrity: "貂蝉", similarity: 85, description: "三国四大美女之一，以美貌倾国。", dynasty: "东汉" },
  { score: 76, celebrity: "诸葛亮", similarity: 73, description: "三国时期蜀汉丞相，智慧化身。", dynasty: "三国" },
];

const FEATURE_CARDS = [
  { icon: "✦", title: "AI颜值评分", desc: "基于五官比例、面部对称性综合评分" },
  { icon: "⚡", title: "历史名人匹配", desc: "找出与你最相似的历史名人" },
  { icon: "◈", title: "趣味颜值报告", desc: "生成专属档案，一键分享朋友圈" },
];

function StarRating({ score }: { score: number }) {
  const fullStars = Math.floor(score / 20);
  const hasHalf = score % 20 >= 10;
  return (
    <div className="flex gap-1 justify-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="text-2xl"
          style={{
            color:
              i <= fullStars
                ? "hsl(var(--gold))"
                : i === fullStars + 1 && hasHalf
                ? "hsl(var(--gold))"
                : "hsl(var(--muted-foreground) / 0.3)",
          }}
        >
          {i <= fullStars ? "★" : i === fullStars + 1 && hasHalf ? "⭐" : "☆"}
        </span>
      ))}
    </div>
  );
}

function ScoreCircle({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const strokeDash = (score / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center w-36 h-36">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="54" fill="none"
          stroke="hsl(var(--crimson))"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
        />
      </svg>
      <div className="text-center animate-score">
        <div
          className="text-4xl font-black"
          style={{ fontFamily: "'Noto Serif SC', serif", color: "hsl(var(--crimson))" }}
        >
          {score}
        </div>
        <div className="text-xs text-muted-foreground font-medium tracking-wider">颜值分</div>
      </div>
    </div>
  );
}

export default function Index() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("请上传图片文件（JPG/PNG）");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("图片大小不能超过5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
      setAppState("uploaded");
      setResult(null);
      setErrorMsg("");
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  };

  const handlePayAndAnalyze = async () => {
    setAppState("paying");
    await new Promise((r) => setTimeout(r, 1200));
    setAppState("analyzing");
    await new Promise((r) => setTimeout(r, 2000));
    const mockResult = MOCK_RESULTS[Math.floor(Math.random() * MOCK_RESULTS.length)];
    setResult(mockResult);
    setAppState("result");
  };

  const handleReset = () => {
    setAppState("idle");
    setPreviewUrl(null);
    setResult(null);
    setErrorMsg("");
  };

  const isPaying = appState === "paying";
  const isAnalyzing = appState === "analyzing";
  const showResult = appState === "result" && result !== null;
  const hasPhoto = previewUrl !== null;

  return (
    <div className="min-h-screen" style={{ background: "hsl(var(--background))", maxWidth: "480px", margin: "0 auto" }}>

      {/* ── HERO HEADER ── */}
      <div
        className="relative overflow-hidden"
        style={{ backgroundImage: `url(${heroBg})`, backgroundSize: "cover", backgroundPosition: "center top" }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, hsl(5 70% 18% / 0.82) 0%, hsl(5 70% 14% / 0.92) 100%)" }}
        />
        <div className="relative z-10 text-center px-6 pt-12 pb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-12" style={{ background: "hsl(var(--gold) / 0.6)" }} />
            <span className="text-xs tracking-[0.3em]" style={{ color: "hsl(var(--gold) / 0.8)" }}>
              AI 颜值鉴定
            </span>
            <div className="h-px w-12" style={{ background: "hsl(var(--gold) / 0.6)" }} />
          </div>

          <h1
            className="brand-title text-6xl mb-3"
            style={{ textShadow: "0 2px 20px hsl(40 80% 55% / 0.4)" }}
          >
            颜究院
          </h1>
          <p className="text-sm font-light tracking-wide mb-1" style={{ color: "hsl(var(--primary-foreground) / 0.9)" }}>
            AI颜值分析 · 发现你的历史原型
          </p>
          <p className="text-xs" style={{ color: "hsl(var(--gold) / 0.7)" }}>
            测测你像哪位历史名人
          </p>

          <div className="flex justify-center gap-3 mt-6">
            {["五官分析", "名人匹配", "颜值档案"].map((tag) => (
              <div
                key={tag}
                className="px-3 py-1 rounded-full text-xs border"
                style={{
                  borderColor: "hsl(var(--gold) / 0.4)",
                  color: "hsl(var(--gold) / 0.85)",
                  background: "hsl(var(--gold) / 0.08)",
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-5">

        {/* ── FEATURE CARDS ── */}
        <div className="grid grid-cols-3 gap-3">
          {FEATURE_CARDS.map((card) => (
            <div key={card.title} className="card-feature p-3 text-center">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-2 text-lg"
                style={{ background: "hsl(var(--crimson) / 0.1)", color: "hsl(var(--crimson))" }}
              >
                {card.icon}
              </div>
              <div className="text-xs font-semibold mb-1" style={{ color: "hsl(var(--foreground))" }}>
                {card.title}
              </div>
              <div className="text-[10px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                {card.desc}
              </div>
            </div>
          ))}
        </div>

        {/* ── UPLOAD AREA ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: "hsl(var(--crimson))" }} />
            <h2 className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              上传照片
            </h2>
          </div>

          {previewUrl ? (
            <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "1", background: "hsl(var(--muted))" }}>
              <img src={previewUrl} alt="预览" className="w-full h-full object-cover" />
              <button
                onClick={handleReset}
                className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-opacity hover:opacity-90"
                style={{ background: "hsl(0 0% 0% / 0.5)", color: "white" }}
              >
                ✕
              </button>
              {showResult && (
                <div
                  className="absolute bottom-0 left-0 right-0 py-2 text-center text-xs font-medium"
                  style={{ background: "hsl(var(--crimson) / 0.85)", color: "hsl(var(--primary-foreground))" }}
                >
                  分析完成 ✓
                </div>
              )}
            </div>
          ) : (
            <div
              className="upload-zone flex flex-col items-center justify-center gap-3 cursor-pointer"
              style={{ minHeight: "200px" }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl animate-pulse-ring"
                style={{ background: "hsl(var(--crimson) / 0.08)", color: "hsl(var(--crimson))" }}
              >
                📷
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                  点击上传照片
                </p>
                <p className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                  支持 JPG / PNG，最大 5MB
                </p>
              </div>
            </div>
          )}

          {!previewUrl && (
            <div className="flex gap-3 mt-3">
              <button
                className="flex-1 py-3 rounded-xl text-sm font-medium border transition-all hover:shadow-sm active:scale-95"
                style={{
                  borderColor: "hsl(var(--crimson) / 0.4)",
                  color: "hsl(var(--crimson))",
                  background: "hsl(var(--crimson) / 0.05)",
                }}
                onClick={() => cameraInputRef.current?.click()}
              >
                📷 拍照
              </button>
              <button
                className="flex-1 py-3 rounded-xl text-sm font-medium border transition-all hover:shadow-sm active:scale-95"
                style={{
                  borderColor: "hsl(var(--crimson) / 0.4)",
                  color: "hsl(var(--crimson))",
                  background: "hsl(var(--crimson) / 0.05)",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                🖼️ 相册上传
              </button>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileChange} />

          {errorMsg && (
            <p className="text-xs mt-2 text-center" style={{ color: "hsl(var(--destructive))" }}>
              {errorMsg}
            </p>
          )}
        </div>

        {/* ── PAYMENT BUTTON ── */}
        <div>
          <button
            className="btn-brand w-full py-4 rounded-2xl text-base font-bold tracking-wide transition-all active:scale-95"
            disabled={!hasPhoto || isPaying || isAnalyzing || showResult}
            onClick={handlePayAndAnalyze}
          >
            {isPaying ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                支付中...
              </span>
            ) : isAnalyzing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                AI分析中，请稍候...
              </span>
            ) : showResult ? (
              "✓ 分析完成"
            ) : !hasPhoto ? (
              "请先上传照片"
            ) : (
              "¥ 0.5  立即测颜值"
            )}
          </button>
          {!showResult && (
            <p className="text-center text-xs mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              仅需0.5元 · 安全支付 · 即时出结果
            </p>
          )}
        </div>

        {/* ── RESULT AREA ── */}
        {showResult && result ? (
          <div className="result-card p-5 space-y-5 animate-fade-in-up">
            <div className="text-center">
              <h3
                className="text-sm font-medium mb-4"
                style={{ color: "hsl(var(--muted-foreground))", letterSpacing: "0.1em" }}
              >
                — 你的颜值报告 —
              </h3>
              <ScoreCircle score={result.score} />
              <div className="mt-3">
                <StarRating score={result.score} />
                <p className="text-xs mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {result.score >= 90
                    ? "天赋异禀，倾国倾城"
                    : result.score >= 80
                    ? "颜值出众，气质非凡"
                    : result.score >= 70
                    ? "五官端正，清秀悦目"
                    : "形象得体，气质温和"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
              <span className="text-xs px-2" style={{ color: "hsl(var(--gold))" }}>◆</span>
              <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
            </div>

            {/* Celebrity Match */}
            <div
              className="rounded-xl p-4"
              style={{ background: "hsl(var(--crimson) / 0.04)", border: "1px solid hsl(var(--crimson) / 0.12)" }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-3xl"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--crimson) / 0.15), hsl(var(--gold) / 0.1))",
                    border: "2px solid hsl(var(--gold) / 0.3)",
                  }}
                >
                  👤
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className="text-lg font-bold"
                      style={{ fontFamily: "'Noto Serif SC', serif", color: "hsl(var(--crimson))" }}
                    >
                      {result.celebrity}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "hsl(var(--gold) / 0.15)",
                        color: "hsl(35 70% 40%)",
                        border: "1px solid hsl(var(--gold) / 0.3)",
                      }}
                    >
                      {result.dynasty}
                    </span>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>相似度</span>
                      <span className="font-semibold" style={{ color: "hsl(var(--crimson))" }}>
                        {result.similarity}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${result.similarity}%`,
                          background: "var(--gradient-brand)",
                          transition: "width 1s ease 0.3s",
                        }}
                      />
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {result.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Share hint */}
            <div
              className="rounded-xl p-3 text-center text-xs"
              style={{
                background: "hsl(var(--gold) / 0.08)",
                border: "1px dashed hsl(var(--gold) / 0.35)",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              📸 截图分享到朋友圈，让好友也来测一测
            </div>

            {/* Reset */}
            <button
              className="w-full py-3 rounded-xl text-sm font-medium border transition-all hover:shadow-sm active:scale-95"
              style={{
                borderColor: "hsl(var(--border))",
                color: "hsl(var(--muted-foreground))",
                background: "transparent",
              }}
              onClick={handleReset}
            >
              重新测评
            </button>
          </div>
        ) : null}

        {/* ── FOOTER ── */}
        <div className="text-center pb-6 pt-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-px w-8" style={{ background: "hsl(var(--border))" }} />
            <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              颜究院
            </span>
            <div className="h-px w-8" style={{ background: "hsl(var(--border))" }} />
          </div>
          <p className="text-[10px]" style={{ color: "hsl(var(--muted-foreground) / 0.6)" }}>
            结果仅供娱乐参考 · 版权所有
          </p>
        </div>
      </div>
    </div>
  );
}
