import { SerkleLoader } from "@/components/ui/SerkleLoader";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./AskDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Lock,
  Send,
  X,
  Plus,
  Sparkles,
  BadgeCheck,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateQuestion } from "@/hooks/useQuestions";
import { useIsExpert } from "@/hooks/useExpertProfiles";
import { supabase } from "@/integrations/supabase/client";
import { generateRandomPseudonym } from "@/utils/anonymousIdentity";
import { AnonymousAvatar } from "./AnonymousAvatar";
import { useUser } from "@/contexts/UserContext";
import { ASK_CATEGORIES } from "@/lib/askPresentation";

interface AskQuestionFormProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "question" | "story";
}

const CATEGORIES = ASK_CATEGORIES.map((category) => ({
  ...category,
  icon: null,
}));

// Keyword-to-tag mapping for smart client-side tag suggestions
const TAG_KEYWORDS: Record<string, string[]> = {
  marriage: ["husband", "wife", "married", "spouse", "wedding", "divorce"],
  relationships: [
    "partner",
    "boyfriend",
    "girlfriend",
    "dating",
    "breakup",
    "love",
    "together",
  ],
  communication: [
    "talk",
    "argue",
    "fighting",
    "listen",
    "conversation",
    "silent",
    "discuss",
  ],
  money: [
    "money",
    "financial",
    "budget",
    "salary",
    "debt",
    "savings",
    "expensive",
    "afford",
    "income",
  ],
  parenting: [
    "child",
    "children",
    "kid",
    "baby",
    "toddler",
    "son",
    "daughter",
    "parent",
  ],
  school: [
    "school",
    "teacher",
    "grades",
    "homework",
    "college",
    "university",
    "student",
  ],
  anxiety: [
    "anxious",
    "anxiety",
    "worried",
    "panic",
    "nervous",
    "stress",
    "stressed",
    "overwhelm",
  ],
  depression: [
    "depressed",
    "depression",
    "sad",
    "hopeless",
    "lonely",
    "crying",
    "numb",
  ],
  "self-care": [
    "tired",
    "exhausted",
    "burnout",
    "sleep",
    "rest",
    "overwhelmed",
    "self-care",
  ],
  pregnancy: [
    "pregnant",
    "pregnancy",
    "expecting",
    "trimester",
    "prenatal",
    "newborn",
    "birth",
  ],
  "work-life-balance": [
    "work",
    "job",
    "career",
    "boss",
    "office",
    "remote",
    "promotion",
    "quit",
  ],
  trust: [
    "trust",
    "cheat",
    "cheating",
    "lie",
    "lying",
    "suspicious",
    "faithful",
  ],
  "family-dynamics": [
    "mother",
    "father",
    "sibling",
    "in-law",
    "in-laws",
    "family",
    "relative",
  ],
  health: [
    "doctor",
    "medical",
    "sick",
    "hospital",
    "diagnosis",
    "symptoms",
    "pain",
    "medication",
  ],
  discipline: [
    "discipline",
    "behavior",
    "tantrum",
    "punishment",
    "rules",
    "boundaries",
  ],
  teenager: ["teenager", "teen", "adolescent", "puberty", "rebellion"],
  nutrition: [
    "food",
    "eating",
    "diet",
    "nutrition",
    "weight",
    "feeding",
    "breastfeeding",
  ],
  friendship: ["friend", "friends", "friendship", "social", "toxic"],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  parenting: [
    "baby",
    "toddler",
    "child",
    "children",
    "kid",
    "infant",
    "potty",
    "tantrum",
    "sleep train",
    "daycare",
    "preschool",
    "parent",
    "parenting",
    "teething",
    "weaning",
  ],
  relationships: [
    "husband",
    "wife",
    "married",
    "marriage",
    "spouse",
    "partner",
    "dating",
    "boyfriend",
    "girlfriend",
    "in-law",
    "in-laws",
    "divorce",
    "fighting",
    "cheating",
    "ex-husband",
    "ex-wife",
  ],
  health: [
    "doctor",
    "pediatrician",
    "sick",
    "fever",
    "cough",
    "hospital",
    "medicine",
    "symptom",
    "pain",
    "vomit",
    "rash",
    "allergy",
    "pregnant",
    "pregnancy",
    "postpartum",
    "breastfeeding",
  ],
  "mental-health": [
    "anxious",
    "anxiety",
    "depressed",
    "depression",
    "burnout",
    "overwhelmed",
    "crying",
    "lonely",
    "stress",
    "therapy",
    "therapist",
    "panic",
    "mental health",
  ],
  education: [
    "school",
    "teacher",
    "homework",
    "grades",
    "reading",
    "math",
    "kindergarten",
    "learning",
    "adhd",
    "tutor",
  ],
  career: [
    "work",
    "job",
    "boss",
    "coworker",
    "career",
    "maternity leave",
    "paternity leave",
    "promotion",
    "salary",
    "resume",
    "quit",
    "office",
  ],
  family: [
    "family",
    "mother",
    "father",
    "sister",
    "brother",
    "grandparent",
    "household",
    "chores",
    "co-parenting",
  ],
  lifestyle: [
    "routine",
    "meal",
    "cooking",
    "travel",
    "budget",
    "spending",
    "savings",
    "moving",
    "home",
  ],
};

function suggestCategory(questionText: string): string | null {
  const lower = questionText.toLowerCase();
  let bestCategory: string | null = null;
  let maxMatches = 0;

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let matches = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        matches++;
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = cat;
    }
  }

  return maxMatches >= 1 ? bestCategory : null;
}

const CRISIS_KEYWORDS = [
  "suicide",
  "kill myself",
  "end my life",
  "hurt myself",
  "cutting myself",
  "self harm",
  "self-harm",
  "overdose",
  "abusive partner",
  "domestic violence",
  "beat me",
];

function checkCrisisContent(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

function suggestTags(questionText: string): string[] {
  const lowerText = questionText.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        scores[tag] = (scores[tag] || 0) + 1;
      }
    }
  }

  // Sort by score descending, return top 4
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag]) => tag);
}

export const AskQuestionForm: React.FC<AskQuestionFormProps> = ({
  isOpen,
  onClose,
  mode = "question",
}) => {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [hasSuggestedTags, setHasSuggestedTags] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [identityMode, setIdentityMode] = useState<"anonymous" | "profile">(
    "anonymous",
  );
  const [anonymousName, setAnonymousName] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [postingUserId, setPostingUserId] = useState("");
  const [identityReady, setIdentityReady] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const [publishError, setPublishError] = useState("");
  const publishLock = useRef(false);
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(
    null,
  );
  const [isCrisisDetected, setIsCrisisDetected] = useState(false);
  const [similarQuestions, setSimilarQuestions] = useState<any[]>([]);
  const { toast } = useToast();
  const createQuestion = useCreateQuestion();
  const { user: publicProfile } = useUser();
  const publicName =
    publicProfile?.id === postingUserId
      ? publicProfile.name || publicProfile.username
      : "Your public profile";
  const {
    data: isExpert,
    error: expertError,
    refetch: retryExpert,
  } = useIsExpert(postingUserId);
  const identityKnown =
    identityReady &&
    (!isAuthenticated || typeof isExpert === "boolean") &&
    !expertError;
  const limit = mode === "story" ? 2000 : 1000;

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (identityMode === "anonymous" && isAuthenticated) {
      generateAnonymousName();
    } else {
      setAnonymousName("");
    }
  }, [identityMode, isAuthenticated]);

  // Generate tag suggestions, category suggestion, similar questions, and safety checks (debounced)
  useEffect(() => {
    if (question.trim().length < 10) {
      setSuggestedTags([]);
      setHasSuggestedTags(false);
      setSuggestedCategory(null);
      setIsCrisisDetected(false);
      setSimilarQuestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      // 1. Tag suggestions
      const suggestions = suggestTags(question);
      setSuggestedTags(suggestions);
      if (suggestions.length > 0 && !hasSuggestedTags) {
        setTags(suggestions);
        setHasSuggestedTags(true);
      }

      // 2. Category suggestions
      const cat = suggestCategory(question);
      setSuggestedCategory(cat);

      // 3. Crisis & safety detection
      setIsCrisisDetected(checkCrisisContent(question));

      // 4. Similar existing questions
      if (question.trim().length >= 18) {
        const words = question
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, "")
          .split(" ")
          .filter((w) => w.length >= 4)
          .slice(0, 3);

        if (words.length > 0) {
          try {
            const { data } = await supabase
              .from("questions")
              .select("id, question, category, answers(count)")
              .or(words.map((w) => `question.ilike.%${w}%`).join(","))
              .limit(2);
            setSimilarQuestions(data || []);
          } catch (err) {
            console.warn("Error fetching similar questions:", err);
          }
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [question, hasSuggestedTags]);

  const checkAuth = async () => {
    setIdentityReady(false);
    setIdentityError("");
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      setIsAuthenticated(!!user);
      setPostingUserId(user?.id || "");
      setIdentityReady(true);
    } catch {
      setIdentityError(
        "Your posting identity could not be loaded. Please try again.",
      );
    }
  };

  const generateAnonymousName = () => {
    setAnonymousName(generateRandomPseudonym());
  };

  const handleTagRemove = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagAdd = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 6) {
      setTags([...tags, tag]);
    }
  };

  const handleCustomTagSubmit = () => {
    const trimmed = customTagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (trimmed && !tags.includes(trimmed) && tags.length < 6) {
      setTags([...tags, trimmed]);
      setCustomTagInput("");
      setShowCustomInput(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (publishLock.current || !identityKnown) return;

    if (!question.trim() || (!category && mode !== "story")) {
      toast({
        title: "Incomplete form",
        description: !question.trim()
          ? "Please write your question."
          : "Please select a category.",
        variant: "destructive",
      });
      return;
    }

    const isAnonymous = isExpert ? false : identityMode === "anonymous";
    publishLock.current = true;
    setPublishError("");

    try {
      await createQuestion.mutateAsync({
        question: question.trim(),
        category: category || "other",
        tags,
        isAnonymous: isExpert ? false : isAuthenticated ? isAnonymous : true,
        anonymousName:
          isAuthenticated && isAnonymous && !isExpert
            ? anonymousName
            : undefined,
        isThread: mode === "story",
      });

      setQuestion("");
      setCategory("");
      setTags([]);
      setSuggestedTags([]);
      setHasSuggestedTags(false);
      setIdentityMode("anonymous");
      onClose();
    } catch (error) {
      console.error("Error submitting question:", error);
      setPublishError(
        "Your post could not be saved. Your text is still here; please try again.",
      );
    } finally {
      publishLock.current = false;
    }
  };

  const isFormValid =
    question.trim().length > 0 &&
    question.length <= limit &&
    (category.length > 0 || mode === "story") &&
    identityKnown;

  // Tags that were suggested but the user removed — show them as "re-add" options
  const removedSuggestions = suggestedTags.filter((t) => !tags.includes(t));

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        if (!createQuestion.isPending) onClose();
      }}
    >
      <DialogContent
        busy={createQuestion.isPending}
        className="max-w-lg max-h-[90vh] overflow-y-auto p-0"
      >
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-lg font-semibold text-foreground">
            {mode === "story" ? "Share your story" : "Let’s talk about it"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Choose how you appear, then share with the community.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-5">
          {/* STEP 1 — Question */}
          <div className="space-y-2">
            <Label htmlFor="question" className="text-sm font-medium">
              {mode === "story" ? "Your story" : "What would you like to ask?"}
            </Label>
            <Textarea
              id="question"
              placeholder="Share what's on your mind. The more detail you give, the better advice you'll get..."
              value={question}
              maxLength={limit}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[110px] resize-none text-[15px] leading-relaxed"
              required
            />
            <p className="text-xs text-muted-foreground text-right">
              {question.length}/{limit} characters
            </p>

            {/* Crisis & Safety Support Banner */}
            {isCrisisDetected && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1.5 animate-in fade-in duration-200">
                <div className="font-semibold flex items-center gap-1.5 text-[13px]">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                  Immediate Support & Crisis Resources
                </div>
                <p className="leading-relaxed text-destructive/90">
                  If you or someone in your home is in crisis or danger, please
                  connect directly with immediate support: Call or text{" "}
                  <strong className="underline">988</strong> (Suicide & Crisis
                  Lifeline) or your local emergency services (
                  <strong>911</strong>). Community forums cannot substitute for
                  urgent crisis care.
                </p>
              </div>
            )}

            {/* Similar Questions Recommendation */}
            {similarQuestions.length > 0 && (
              <div className="p-3 rounded-lg bg-primary/[0.04] border border-primary/20 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5 text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    Similar questions already answered by community:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSimilarQuestions([])}
                    className="text-muted-foreground hover:text-foreground text-[11px]"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="space-y-1.5">
                  {similarQuestions.map((sq: any) => (
                    <a
                      key={sq.id}
                      href={`/ask/question/${sq.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between text-xs text-foreground/90 hover:text-primary transition-colors py-1 px-2 rounded hover:bg-background/80"
                    >
                      <span className="truncate pr-2">“{sq.question}”</span>
                      <span className="text-[11px] text-muted-foreground flex-shrink-0 flex items-center gap-1">
                        {sq.answers?.[0]?.count || 0} answers
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* STEP 2 — Category (required) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Category{" "}
                {mode === "story" ? (
                  <span className="text-muted-foreground">(optional)</span>
                ) : (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              {suggestedCategory && category !== suggestedCategory && (
                <button
                  type="button"
                  onClick={() => setCategory(suggestedCategory)}
                  className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  <Sparkles className="w-3 h-3" />
                  Apply suggested:{" "}
                  {
                    CATEGORIES.find(
                      (c) => c.value === suggestedCategory,
                    )?.label.split(" & ")[0]
                  }
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = category === cat.value;
                const isSuggested = suggestedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`
                      relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                      transition-all duration-150 border text-left
                      ${
                        isActive
                          ? "bg-primary/10 text-primary border-primary ring-1 ring-primary/30"
                          : isSuggested
                            ? "bg-primary/5 text-primary/80 border-primary/30 hover:bg-primary/10"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                      }
                    `}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate">
                      {cat.label.split(" & ")[0]}
                    </span>
                    {isSuggested && !isActive && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3 — Smart topics/tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Topics
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
            </div>

            {tags.length === 0 &&
              suggestedTags.length === 0 &&
              question.trim().length < 15 && (
                <p className="text-xs text-muted-foreground italic">
                  Start writing your question and we'll suggest relevant topics.
                </p>
              )}

            {/* Active tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer gap-1 pr-1.5 transition-colors"
                    onClick={() => handleTagRemove(tag)}
                  >
                    {tag}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Removed suggestions — available to re-add */}
            {removedSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {removedSuggestions.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted/80 text-muted-foreground transition-colors"
                    onClick={() => handleTagAdd(tag)}
                  >
                    + {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Add custom tag */}
            {tags.length < 6 && (
              <>
                {showCustomInput ? (
                  <div className="flex gap-2">
                    <Input
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCustomTagSubmit();
                        }
                      }}
                      placeholder="Type a topic..."
                      className="h-8 text-sm flex-1"
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={handleCustomTagSubmit}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setShowCustomInput(false);
                        setCustomTagInput("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(true)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    Add a topic
                  </button>
                )}
              </>
            )}
          </div>

          {/* STEP 4 — Identity */}
          {isAuthenticated && !isExpert && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Post as</Label>
              <RadioGroup
                value={identityMode}
                onValueChange={(val) =>
                  setIdentityMode(val as "anonymous" | "profile")
                }
                className="space-y-2"
              >
                <label
                  htmlFor="identity-anonymous"
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                    identityMode === "anonymous"
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-background hover:bg-muted/30"
                  }`}
                >
                  <RadioGroupItem value="anonymous" id="identity-anonymous" />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Anonymous
                    </span>
                    {identityMode === "anonymous" && anonymousName && (
                      <span className="text-xs text-muted-foreground">
                        as {anonymousName}
                      </span>
                    )}
                  </div>
                  {identityMode === "anonymous" && anonymousName && (
                    <AnonymousAvatar pseudonym={anonymousName} size={28} />
                  )}
                </label>

                <label
                  htmlFor="identity-profile"
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                    identityMode === "profile"
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-background hover:bg-muted/30"
                  }`}
                >
                  <RadioGroupItem value="profile" id="identity-profile" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">
                      Post with my profile
                    </span>
                  </div>
                </label>
              </RadioGroup>

              {identityMode === "anonymous" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                  <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your name and profile won't be shown on this question.
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      Your anonymous identity is unique to this story.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expert notice — experts always post with identity */}
          {isAuthenticated && isExpert && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <BadgeCheck className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Posting as Verified Expert
                </p>
                <p className="text-xs text-muted-foreground">
                  Your expert badge will be shown. Experts cannot post
                  anonymously.
                </p>
              </div>
            </div>
          )}

          {/* Unauthenticated users — always anonymous */}
          {!isAuthenticated && identityReady && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
              <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your public post will appear as Anonymous.
              </p>
            </div>
          )}

          {/* STEP 5 — Submit */}
          <div className="ask-compose-actions">
            <div className="ask-public-identity">
              Public identity preview
              <strong>
                {!identityKnown
                  ? "Checking your identity…"
                  : isExpert
                    ? `Verified expert · ${publicName}`
                    : isAuthenticated && identityMode === "profile"
                      ? `Profile · ${publicName}`
                      : anonymousName
                        ? `Anonymous · ${anonymousName}`
                        : "Anonymous"}
              </strong>
            </div>
            {(identityError || expertError) && (
              <div className="ask-error" role="alert">
                {identityError ||
                  "Expert status could not be checked. Please try again."}
                <button
                  type="button"
                  className="ask-button ask-button--quiet"
                  onClick={() => {
                    void checkAuth();
                    void retryExpert();
                  }}
                >
                  Retry identity check
                </button>
              </div>
            )}
            {publishError && (
              <p className="ask-error" role="alert">
                {publishError}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={createQuestion.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createQuestion.isPending || !isFormValid}
                className="flex-[2] bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:shadow-elegant transition-all duration-200"
              >
                {createQuestion.isPending ? (
                  <>
                    <SerkleLoader
                      size="xs"
                      className="text-current object-contain mr-2"
                    />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {mode === "story" ? "Publish story" : "Publish question"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
