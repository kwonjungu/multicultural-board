import type { BeeExpression, BeeParticles } from "@/components/tutorial/BeeGuide";

export type TutorialSectionId =
  | "main" | "board" | "interpreter" | "games" | "praise" | "vocab";

/**
 * Dialogue line spoken by the bee. A single step can contain multiple lines
 * that the user advances through by clicking / pressing space.
 */
export interface DialogueLine {
  text: string;
  /** Override the speaker's expression for this line. */
  expression?: BeeExpression;
  /** Typing speed (ms per char). Default 32. 0 = instant. */
  speed?: number;
}

/** A single tutorial beat. Executed in order until the scenario ends. */
export type TutorialStep =
  /** Bee speaks without pointing at anything. */
  | {
      kind: "speak";
      expression?: BeeExpression;
      /** Where the bee should float to (selector or corner). */
      anchor?: AnchorSpec;
      lines: DialogueLine[];
      particles?: BeeParticles;
    }
  /** Bee points at a target and highlights it. Auto-advances on click unless waitFor overrides. */
  | {
      kind: "highlight";
      target: string;                 // CSS selector of the element to spotlight
      side?: "left" | "right" | "top" | "bottom";
      expression?: BeeExpression;
      lines: DialogueLine[];
      /** If set, advance only on this event. Otherwise advance on dialogue end. */
      waitFor?: WaitCondition;
    }
  /** Wait for user action on a target (no dialogue by itself). */
  | {
      kind: "await";
      target: string;
      hint?: string;                  // small floating label near target
      expression?: BeeExpression;
      waitFor: WaitCondition;
      /** On wrong click elsewhere, show this reaction. */
      onWrong?: { expression?: BeeExpression; say: string };
      side?: "left" | "right" | "top" | "bottom";
    }
  /** Celebrate a milestone: confetti, bee dances, optional sticker reward. */
  | {
      kind: "celebrate";
      lines: DialogueLine[];
      reward?: { emoji: string; label: string };
    }
  /**
   * 섹션 직접 진입 (설계서 항목 11). TutorialBus 로 "tutorial-navigate" 를
   * 발행하면 화면 소유자(예: RoomPage)가 hubView 를 전환한다.
   * waitSelector 가 DOM 에 나타나면(또는 6초 타임아웃) 다음 스텝으로 자동 진행.
   */
  | {
      kind: "navigate";
      /** 목적지 — HubView 값("board"|"games"|"vocab"|"dashboard"|"storybook") 또는 "hub" */
      to: string;
      /** 목적지 화면 렌더 확인용 selector. 생략 시 700ms 후 진행. */
      waitSelector?: string;
    };

export type WaitCondition =
  | { event: "click"; target: string }
  | { event: "input"; target: string; minLength?: number }
  | { event: "submit"; target: string }
  | { event: "custom"; id: string };       // emitted via TutorialBus.emit(id)

export interface AnchorSpec {
  /** CSS selector to fly to. */
  selector?: string;
  side?: "left" | "right" | "top" | "bottom";
  /** Or a fixed corner. Applied if selector is omitted. */
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
}

export interface TutorialScenario {
  id: TutorialSectionId;
  title: string;                  // ko label ("메인 허브 둘러보기")
  estimatedMinutes: number;
  steps: TutorialStep[];
  /**
   * Mandatory tutorials (e.g., main hub intro) hide the Skip button and
   * track completion in Firebase so the user can't evade them by reloading
   * or switching devices.
   */
  mandatory?: boolean;
}

export interface TutorialProgress {
  completed: TutorialSectionId[];
  skippedGlobally: boolean;
}
