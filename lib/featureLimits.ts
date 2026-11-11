// 학생이 이용하는 앱에서 중단한 기능의 공통 안내.
// Gemini API 약관은 18세 미만이 이용할 가능성이 높은 앱에서의 사용을 금지한다.
export const PHOTO_OCR_DISABLED_MESSAGE =
  "사진 글자 인식은 현재 사용할 수 없어요. PDF 파일을 이용해 주세요.";

/** 심사용 학급방. 여러 심사위원이 같은 교사 입장 코드를 쓴다. */
export const REVIEW_ROOM_CODE = "1111";

/**
 * 그림책 그림의 앱 내 생성 여부. 교사 전용 제작 화면에서만 호출된다(학생 기기에서는 호출하지 않음).
 * false 로 두면 앱에서는 그림을 만들지 않고 교사 PC 도구(scripts/storybook-images-local.mjs)로만 등록한다.
 */
export const STORYBOOK_IMAGE_IN_APP = true;

export const STORYBOOK_IMAGE_LOCAL_NOTICE =
  "그림은 이 화면에서 만들지 않아요. 수업 전에 교사 컴퓨터의 그림 도구로 만들어 등록합니다. (그림이 없는 동안에는 이모지 그림으로 보여요.)";
