import React from "react";
import { AskQuestionForm } from "./AskQuestionForm";
export function AnonymousStoryModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return <AskQuestionForm isOpen={isOpen} onClose={onClose} mode="story" />;
}
