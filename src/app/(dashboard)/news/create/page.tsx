"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Quote,
  Image as ImageIcon,
  Video,
  X,
  Eye,
  Edit3,
  Save,
  Send,
  Loader2,
  FileText,
  Tag as TagIcon,
  Sparkles,
  Wand2,
} from "lucide-react";

// ─── Constants ───

const CATEGORIES = [
  "Politics",
  "Technology",
  "Business",
  "Sports",
  "Entertainment",
  "Health",
  "Local",
  "Opinion",
];

const TAG_LIST = [
  "elections", "economy", "security", "infrastructure", "innovation",
  "agriculture", "education", "energy", "sports", "culture",
];

// ─── Component ───

export default function CreateArticlePage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // AI generation state
  const [aiTopic, setAiTopic] = useState("");
  const [aiTone, setAiTone] = useState("neutral");
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Geo hierarchy
  const { data: geoHierarchy } = useQuery<{ states: string[]; lgas: string[] }>({
    queryKey: ["/api/geo/hierarchy"],
  });

  const states = geoHierarchy?.states ?? [];
  const lgas = geoHierarchy?.lgas ?? [];

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string;
      content: string;
      excerpt: string;
      category: string;
      tags: string[];
      state: string;
      lga: string;
      coverImageUrl?: string;
      mediaUrls: string[];
      status: "draft" | "published";
    }) => apiRequest("POST", "/api/news/create", data),
    onSuccess: (_data, variables) => {
      toast({
        title: variables.status === "draft" ? "Draft saved" : "Article published",
        description:
          variables.status === "draft"
            ? "Your draft has been saved."
            : "Your article has been published.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/news/feed"] });
      router.push("/news");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save article", description: err.message, variant: "destructive" });
    },
  });

  // AI article generation mutation
  const aiGenerateMutation = useMutation({
    mutationFn: async (data: { topic: string; category: string; state?: string; lga?: string; tone: string }) => {
      const res = await apiRequest("POST", "/api/news/generate", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setTitle(data.title || "");
      setExcerpt(data.excerpt || "");
      if (data.content && editorRef.current) {
        editorRef.current.innerHTML = data.content;
      }
      if (data.suggestedCategory) {
        const cat = CATEGORIES.find(c => c.toLowerCase() === data.suggestedCategory.toLowerCase());
        if (cat) setCategory(cat);
      }
      if (data.tags && Array.isArray(data.tags)) {
        setTags(data.tags.slice(0, 10));
      }
      toast({
        title: "Article generated",
        description: data.source === "kimi" ? "Generated with AI" : "Generated from template (AI not configured)",
      });
      setShowAiPanel(false);
    },
    onError: (err: Error) => {
      toast({ title: "AI generation failed", description: err.message, variant: "destructive" });
    },
  });

  const handleAiGenerate = () => {
    if (!aiTopic.trim()) {
      toast({ title: "Please enter a topic", variant: "destructive" });
      return;
    }
    aiGenerateMutation.mutate({
      topic: aiTopic.trim(),
      category: category?.toLowerCase() || "local",
      state: state || undefined,
      lga: lga || undefined,
      tone: aiTone,
    });
  };

  const focusEditor = () => editorRef.current?.focus();

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    focusEditor();
  };

  const getContent = () => editorRef.current?.innerHTML?.trim() || "";

  const getExcerpt = () => {
    if (excerpt.trim()) return excerpt.trim();
    // Auto-generate from content (strip HTML)
    const text = editorRef.current?.innerText?.trim() || "";
    return text.slice(0, 160) + (text.length > 160 ? "..." : "");
  };

  const handleCoverUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/media/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) setCoverImage(data.url);
      } catch {
        toast({ title: "Image upload failed", variant: "destructive" });
      }
    };
    input.click();
  };

  const handleVideoUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      // Validate duration (max 60s)
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        if (video.duration > 60) {
          toast({
            title: "Video too long",
            description: "Maximum video duration is 60 seconds.",
            variant: "destructive",
          });
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("duration", String(video.duration));
        fetch("/api/media/upload", { method: "POST", body: formData })
          .then((r) => r.json())
          .then((d) => {
            if (d.url) {
              setVideoUrl(d.url);
              toast({ title: "Video uploaded" });
            }
          })
          .catch(() => {
            toast({ title: "Video upload failed", variant: "destructive" });
          });
      };
      video.src = URL.createObjectURL(file);
    };
    input.click();
  };

  const addTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase().replace(/^#/, "");
    if (cleaned && !tags.includes(cleaned)) {
      setTags((t) => [...t, cleaned]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags((t) => t.filter((x) => x !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const validate = (status: "draft" | "published"): boolean => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return false;
    }
    if (!category) {
      toast({ title: "Please select a category", variant: "destructive" });
      return false;
    }
    if (status === "published" && !getContent()) {
      toast({ title: "Content is required to submit", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = (status: "draft" | "published") => {
    if (!validate(status)) return;
    const mediaUrls: string[] = [];
    if (videoUrl) mediaUrls.push(videoUrl);
    createMutation.mutate({
      title: title.trim(),
      content: getContent(),
      excerpt: getExcerpt(),
      category,
      tags,
      state,
      lga,
      coverImageUrl: coverImage || undefined,
      mediaUrls,
      status,
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-700 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Create Article
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Write and publish a news article.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowAiPanel(s => !s)}
            className="gap-1.5"
            data-testid="button-ai-generate"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Generate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((s) => !s)}
            className="gap-1.5"
          >
            {showPreview ? <Edit3 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? "Edit" : "Preview"}
          </Button>
        </div>
      </div>

      {/* AI Generation Panel */}
      <AnimatePresence>
        {showAiPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  AI Article Generator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-topic" className="text-xs">Topic / Prompt</Label>
                  <Input
                    id="ai-topic"
                    data-testid="input-ai-topic"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="e.g. Power outage in Lagos mainland, fuel scarcity in Abuja..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tone</Label>
                    <Select value={aiTone} onValueChange={setAiTone}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="analytical">Analytical</SelectItem>
                        <SelectItem value="inspirational">Inspirational</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category (optional)</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    onClick={handleAiGenerate}
                    disabled={aiGenerateMutation.isPending}
                    className="gap-1.5"
                    data-testid="button-generate-article"
                  >
                    {aiGenerateMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5" /> Generate Article</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAiPanel(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  AI generates a draft article based on your topic. You can edit it before publishing.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Editor ─── */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="wait">
            {showPreview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-border">
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      {category && (
                        <Badge className="text-[10px] border-none bg-primary/90 text-primary-foreground">
                          {category}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl">{title || "Untitled Article"}</CardTitle>
                    <p className="text-sm text-muted-foreground">{getExcerpt()}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverImage} alt={title} className="w-full h-64 object-cover rounded-xl" />
                    )}
                    {videoUrl && (
                      <video src={videoUrl} controls className="w-full rounded-xl" />
                    )}
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: getContent() }}
                    />
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="editor"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter article title..."
                    className="text-base font-medium"
                  />
                </div>

                {/* Cover image + video upload */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCoverUpload} className="gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {coverImage ? "Change Cover" : "Upload Cover"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleVideoUpload} className="gap-1.5">
                    <Video className="h-3.5 w-3.5" />
                    {videoUrl ? "Change Video" : "Upload Video (max 60s)"}
                  </Button>
                </div>

                {coverImage && (
                  <div className="relative rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverImage} alt="cover" className="w-full h-40 object-cover" />
                    <button
                      onClick={() => setCoverImage(null)}
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {videoUrl && (
                  <div className="relative rounded-lg overflow-hidden">
                    <video src={videoUrl} controls className="w-full max-h-40" />
                    <button
                      onClick={() => setVideoUrl(null)}
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Rich text editor */}
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  {/* Toolbar */}
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-0.5 flex-wrap border-b border-border p-1.5 bg-muted/30"
                  >
                    <ToolbarButton onClick={() => exec("bold")} title="Bold"><Bold className="h-3.5 w-3.5" /></ToolbarButton>
                    <ToolbarButton onClick={() => exec("italic")} title="Italic"><Italic className="h-3.5 w-3.5" /></ToolbarButton>
                    <ToolbarButton onClick={() => exec("underline")} title="Underline"><Underline className="h-3.5 w-3.5" /></ToolbarButton>
                    <Divider />
                    <ToolbarButton onClick={() => exec("formatBlock", "<h1>")} title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></ToolbarButton>
                    <ToolbarButton onClick={() => exec("formatBlock", "<h2>")} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></ToolbarButton>
                    <Divider />
                    <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Bullet list"><List className="h-3.5 w-3.5" /></ToolbarButton>
                    <ToolbarButton onClick={() => exec("insertOrderedList")} title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></ToolbarButton>
                    <ToolbarButton onClick={() => exec("formatBlock", "<blockquote>")} title="Quote"><Quote className="h-3.5 w-3.5" /></ToolbarButton>
                    <Divider />
                    <ToolbarButton
                      onClick={() => {
                        const url = window.prompt("Enter URL:");
                        if (url) exec("createLink", url);
                      }}
                      title="Insert link"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton
                      onClick={() => {
                        const url = window.prompt("Enter image URL:");
                        if (url) exec("insertImage", url);
                      }}
                      title="Insert image"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                    </ToolbarButton>
                  </motion.div>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Start writing your article..."
                    className="min-h-[300px] p-4 text-sm prose prose-sm max-w-none focus:outline-none dark:prose-invert empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/60"
                  />
                </div>

                {/* Excerpt */}
                <div className="space-y-1.5">
                  <Label htmlFor="excerpt" className="text-xs">
                    Excerpt <span className="text-muted-foreground/60">(auto-generated if empty)</span>
                  </Label>
                  <Input
                    id="excerpt"
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder="Brief summary of the article..."
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Sidebar settings ─── */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-display">Article Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <TagIcon className="h-3 w-3" />
                  Tags
                </Label>
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Type and press Enter..."
                />
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((t) => (
                      <motion.div
                        key={t}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
                          #{t}
                          <button
                            onClick={() => removeTag(t)}
                            className="rounded-full hover:bg-black/10 p-0.5"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1 pt-1">
                  {TAG_LIST.filter((t) => !tags.includes(t)).slice(0, 5).map((t) => (
                    <button
                      key={t}
                      onClick={() => addTag(t)}
                      className="text-[9px] text-primary hover:underline"
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              </div>

              {/* State / LGA */}
              <div className="space-y-1.5">
                <Label className="text-xs">State</Label>
                <Select value={state} onValueChange={(v) => { setState(v); setLga(""); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">LGA</Label>
                <Select value={lga} onValueChange={setLga}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select LGA" />
                  </SelectTrigger>
                  <SelectContent>
                    {lgas.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => handleSubmit("draft")}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && createMutation.variables?.status === "draft" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save as Draft
            </Button>
            <Button
              className="w-full gap-1.5"
              onClick={() => handleSubmit("published")}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && createMutation.variables?.status === "published" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Publish Article
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7"
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-0.5" />;
}
