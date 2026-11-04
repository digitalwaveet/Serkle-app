import { toast } from "sonner";

/**
 * Shares a circle link using the native share sheet or copies it to the clipboard.
 * @param circleId The ID of the circle to share
 * @param circleName The name of the circle to share
 */
export const shareCircle = async (circleId: string, circleName: string) => {
  const shareLink = `${window.location.origin}/circle/${circleId}`;
  const shareData = {
    title: `Join ${circleName} Circle`,
    text: `Check out this circle on Heart Lens Studio: ${circleName}`,
    url: shareLink,
  };

  try {
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(shareLink);
      toast.success("Link copied to clipboard!");
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('Error sharing:', error);
      // Fallback to clipboard if share fails for other reasons
      try {
        await navigator.clipboard.writeText(shareLink);
        toast.success("Link copied to clipboard!");
      } catch (clipboardError) {
        toast.error("Failed to share link");
      }
    }
  }
};

/**
 * Shares a story author's profile using the native share sheet or clipboard.
 * @param username The story author's username (falls back to their id)
 * @param name The story author's display name
 */
export const shareStory = async (username: string, name: string) => {
  const shareLink = `${window.location.origin}/profile/${username}`;
  const shareData = {
    title: `${name} on Heart Lens Studio`,
    text: `Check out ${name}'s story on Heart Lens Studio`,
    url: shareLink,
  };

  try {
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(shareLink);
      toast.success("Link copied to clipboard!");
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('Error sharing:', error);
      try {
        await navigator.clipboard.writeText(shareLink);
        toast.success("Link copied to clipboard!");
      } catch (clipboardError) {
        toast.error("Failed to share link");
      }
    }
  }
};
