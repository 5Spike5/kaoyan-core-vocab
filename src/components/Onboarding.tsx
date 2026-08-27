import { Check, Target, BookOpenCheck, BarChart3 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const ONBOARDING_KEY = "kaoyan-onboarded";

const STEPS: Array<{
  icon: typeof Target;
  title: string;
  desc: string;
}> = [
  {
    icon: Target,
    title: "设定每日目标",
    desc: "在首页选择每天要学的新词量（60/80/100/120），学满即止，不会多也不会少。",
  },
  {
    icon: BookOpenCheck,
    title: "三种学习模式",
    desc: "「今日背诵」学新词（每词 3 遍穿插）；「强制复习」练到期词；「自主复习」自由刷已学词。",
  },
  {
    icon: BarChart3,
    title: "跟踪你的进度",
    desc: "统计页有学习热力图和正确率趋势；首页的连续天数记录你坚持了多少天。",
  },
];

/** 首次使用引导：三步浮层，完成后写入 localStorage 不再出现。 */
export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(
    () => !localStorage.getItem(ONBOARDING_KEY),
  );

  if (!visible) {
    return null;
  }

  const finish = (startStudying: boolean) => {
    localStorage.setItem(ONBOARDING_KEY, "done");
    setVisible(false);
    if (startStudying) {
      navigate("/review?mode=today");
    }
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="新手引导">
      <div className="onboarding-card">
        <div className="onboarding-icon">
          <Icon size={30} aria-hidden="true" />
        </div>
        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-desc">{current.desc}</p>
        <div className="onboarding-dots" aria-hidden="true">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`onboarding-dot ${index === step ? "active" : ""}`}
            />
          ))}
        </div>
        <div className="onboarding-actions">
          <button
            type="button"
            className="onboarding-skip"
            onClick={() => finish(false)}
          >
            跳过
          </button>
          <div className="onboarding-nav">
            {step > 0 ? (
              <button
                type="button"
                className="onboarding-prev"
                onClick={() => setStep(step - 1)}
              >
                上一步
              </button>
            ) : null}
            <button
              type="button"
              className="onboarding-next"
              onClick={() => (isLast ? finish(true) : setStep(step + 1))}
            >
              {isLast ? (
                <>
                  开始学习
                  <Check size={16} aria-hidden="true" />
                </>
              ) : (
                "下一步"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
