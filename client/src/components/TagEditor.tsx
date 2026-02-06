import { useState, useRef, useEffect } from 'react';
import { X, Plus, Tag, Settings, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

interface TagEditorProps {
  tags: string[];
  allTags: string[];
  onTagsChange: (tags: string[]) => void;
  onAddTag?: (tag: string) => void;
  onDeleteTag?: (tag: string) => void;
  disabled?: boolean;
}

export function TagEditor({ tags, allTags, onTagsChange, onAddTag, onDeleteTag, disabled = false }: TagEditorProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input and exclude already-added tags
  const suggestions = allTags
    .filter(t => !tags.includes(t))
    .filter(t => inputValue.trim() === '' || t.toLowerCase().includes(inputValue.toLowerCase()))
    .slice(0, 5);

  // Quick add: show user's previously used tags (from allTags) that aren't already on this file
  // Limit to 6 most recent/common tags for the quick-add row
  const availableQuickTags = allTags.filter(t => !tags.includes(t)).slice(0, 6);

  const addTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase();
    if (cleaned && !tags.includes(cleaned)) {
      onTagsChange([...tags, cleaned]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onTagsChange(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag when backspace on empty input
      removeTag(tags[tags.length - 1]);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddNewTag = () => {
    const cleanTag = newTagInput.trim().toLowerCase();
    if (cleanTag && onAddTag) {
      onAddTag(cleanTag);
      setNewTagInput('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Tags
        </h4>

        {/* Manage Tags Button - green pill, right next to Tags */}
        {(onAddTag || onDeleteTag) && (
          <Popover open={manageOpen} onOpenChange={setManageOpen}>
            <PopoverTrigger asChild>
              <button className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1">
                <Settings className="h-3 w-3" />
                Manage
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="start">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Manage Your Tags</h4>

                {/* Add new tag section */}
                {onAddTag && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Create new tag</label>
                      <div className="flex gap-2">
                        <Input
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewTag();
                            }
                          }}
                          placeholder="e.g. tax, receipts, invoices..."
                          className="h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3 bg-green-500 hover:bg-green-600"
                          disabled={!newTagInput.trim()}
                          onClick={handleAddNewTag}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Separator />
                  </>
                )}

                {/* Existing tags list */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Your tags {allTags.length > 0 && `(${allTags.length})`}
                  </label>
                  {allTags.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-2">
                      No tags yet. Create your first tag above!
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {allTags.map(tag => (
                        <div
                          key={tag}
                          className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group"
                        >
                          <span className="text-sm flex items-center gap-2">
                            <Tag className="h-3 w-3 text-muted-foreground" />
                            {tag}
                          </span>
                          {onDeleteTag && (
                            <button
                              onClick={() => {
                                if (confirm(`Delete "${tag}" from all files?`)) {
                                  onDeleteTag(tag);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity p-1"
                              title={`Delete "${tag}"`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Current tags */}
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {tags.length === 0 ? (
          <span className="text-sm text-muted-foreground italic">No tags yet - add one below</span>
        ) : (
          tags.map(tag => (
            <Badge
              key={tag}
              variant="secondary"
              className="pl-3 pr-1.5 py-1 text-sm gap-1.5 hover:bg-secondary/80"
            >
              {tag}
              {!disabled && (
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                  title={`Remove tag "${tag}"`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </Badge>
          ))
        )}
      </div>

      {/* Add tag input */}
      {!disabled && (
        <div className="relative" ref={inputRef}>
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={e => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder="Add tag..."
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => inputValue.trim() && addTag(inputValue)}
              disabled={!inputValue.trim()}
              className="h-8 px-3"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md py-1 max-h-40 overflow-y-auto">
              {suggestions.map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => addTag(suggestion)}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick add buttons - show user's previously used tags */}
      {!disabled && availableQuickTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Your tags:</span>
          {availableQuickTags.map(tag => (
            <button
              key={tag}
              onClick={() => addTag(tag)}
              className="text-xs px-2 py-0.5 rounded border border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
