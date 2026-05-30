/* eslint-disable */
// All TikTok DOM selectors live here so they're easy to patch in one place
// when TikTok ships UI changes.

exports.loginIndicator = 'a[href*="/login"]:has-text("Log in")';
exports.captcha = '[id*="captcha"], [class*="captcha"], iframe[src*="captcha"]';

exports.doLike = async (page) => {
  const btn = page.locator('[data-e2e="like-icon"], button[aria-label*="Like" i]').first();
  await btn.waitFor({ state: "visible", timeout: 15000 });
  await btn.click({ delay: 80 + Math.random() * 120 });
  return { ok: true, status: "succeeded" };
};

exports.doComment = async (page, text) => {
  if (!text) return { ok: false, error: "Comment text required" };
  const input = page.locator('[data-e2e="comment-input"], div[contenteditable="true"]').first();
  await input.waitFor({ state: "visible", timeout: 15000 });
  await input.click();
  await input.type(text, { delay: 30 + Math.random() * 40 });
  const post = page.locator('[data-e2e="comment-post"], button:has-text("Post")').first();
  await post.click();
  return { ok: true, status: "succeeded" };
};

exports.doDm = async (page, text) => {
  if (!text) return { ok: false, error: "DM text required" };
  const input = page.locator('[contenteditable="true"], textarea').last();
  await input.waitFor({ state: "visible", timeout: 15000 });
  await input.click();
  await input.type(text, { delay: 30 + Math.random() * 40 });
  await page.keyboard.press("Enter");
  return { ok: true, status: "succeeded" };
};

exports.doPost = async (page, payload) => {
  // Posting requires a local video file at payload.mediaPath. Without one,
  // we can navigate to upload but can't auto-attach — return awaiting.
  if (!payload?.mediaPath) {
    return { ok: false, awaiting: true, status: "needs-login" };
  }
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: 20000 });
  await fileInput.setInputFiles(payload.mediaPath);
  if (payload.text) {
    const caption = page.locator('[contenteditable="true"]').first();
    await caption.waitFor({ state: "visible", timeout: 30000 });
    await caption.click();
    await caption.type(payload.text, { delay: 20 + Math.random() * 40 });
  }
  const postBtn = page.locator('button:has-text("Post")').first();
  await postBtn.waitFor({ state: "visible", timeout: 60000 });
  await postBtn.click();
  return { ok: true, status: "succeeded" };
};