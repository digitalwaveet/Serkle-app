

# Fix: Story Reply Stays in Story Messages (Not Main Messages)

## Problem
When the story owner replies to a message from the Story Activity modal, two issues occur:
1. The owner's replies are not visible in the chat because the query only fetches messages where `receiver_id = user.id`, missing the owner's outgoing replies
2. The chat view filter (`sender_id === chatUserId`) only shows the other person's messages, never the owner's own replies

This makes it appear as if the conversation "goes to the main messages" since nothing shows up in the story activity chat.

## Solution
Fix the data fetching and chat filtering to show both sides of the conversation.

## Technical Changes

### 1. `src/hooks/useStoryActivity.ts` - Fix message query
- Change the messages query from filtering only `receiver_id = user.id` to also include messages where `sender_id = user.id` (the owner's replies)
- Use an `.or()` filter: `receiver_id.eq.${userId},sender_id.eq.${userId}` so both incoming and outgoing messages for the story are fetched

### 2. `src/components/StoryActivityModal.tsx` - Fix chat message filtering
- Change `chatMessages` filter from `m.sender_id === chatUserId` to show messages where either:
  - `sender_id === chatUserId` (messages from the other user), OR
  - `receiver_id === chatUserId` (owner's replies to that user)
- Style the owner's messages differently (right-aligned) to distinguish them from incoming messages

