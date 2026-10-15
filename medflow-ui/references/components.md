# MedFlow Component Catalog

This reference document contains copy-paste ready implementations of every major component pattern in MedFlow HMS.

---

## 1. Search Bar (`GlobalSearch`)

Located at `@/components/global/GlobalSearch`:

```tsx
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GlobalSearchProps {
  search?: string;
  setSearch?: (value: string) => void;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  title?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  onClear?: () => void;
  disabled?: boolean;
}

export const GlobalSearch = ({
  search,
  setSearch,
  value,
  onChange,
  title,
  placeholder,
  className,
  inputClassName,
  onClear,
  disabled = false,
}: GlobalSearchProps) => {
  const currentValue = value !== undefined ? value : search ?? "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) onChange(e);
    if (setSearch) setSearch(e.target.value);
  };

  const handleClear = () => {
    if (onClear) onClear();
    else if (setSearch) setSearch("");
  };

  const computedPlaceholder = placeholder || (title ? `Search ${title}...` : "Search...");

  return (
    <div className={cn("relative w-full sm:w-72 md:w-80", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <Input
        type="text"
        placeholder={computedPlaceholder}
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          "h-10 pl-9 pr-9 rounded-lg text-sm transition-all duration-150",
          "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 shadow-xs",
          "placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100",
          "focus-visible:ring-1 focus-visible:ring-[#0f9d8a] focus-visible:border-[#0f9d8a] focus-visible:ring-offset-0",
          inputClassName,
        )}
      />
      {currentValue.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
```

---

## 2. Table Pagination (`CustomPagination`)

Located at `@/components/global/CustomPagination`:

```tsx
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const CustomPagination = ({
  loading,
  currentPage,
  setPage,
  totalPages,
}: {
  currentPage: number;
  setPage: (page: number) => void;
  totalPages: number;
  loading: boolean;
}) => {
  return (
    <div className="flex items-center justify-end space-x-2 py-4 px-6 border-t border-slate-200 dark:border-slate-800">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1 || loading}
        className="h-8 px-3 text-xs"
      >
        <ChevronLeft className="h-4 w-4 mr-1.5" />
        Previous
      </Button>
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
        Page {currentPage} of {totalPages || 1}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages || totalPages === 0 || loading}
        className="h-8 px-3 text-xs"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1.5" />
      </Button>
    </div>
  );
};
```

---

## 3. Confirmation Dialog (`ConfirmationDialog`)

Located at `@/components/global/ConfirmationDialog`:

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
}: ConfirmationDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1.5">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? "Please wait..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 4. Header & Top Navigation Bar

Located at `@/components/navigation/Header`:

```tsx
<header className="flex h-16 sm:h-[72px] items-center gap-2 sm:gap-3 border-b border-slate-200 bg-white/95 px-3 sm:px-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 min-w-0">
  <SidebarTrigger className="size-9 shrink-0" />
  <Separator orientation="vertical" className="h-6 hidden sm:block" />
  <div className="flex w-full min-w-0 items-center justify-between gap-2">
    <div className="flex flex-col space-y-0.5 min-w-0">
      <h1 className="capitalize text-base sm:text-xl font-bold tracking-tight text-[#19324D] dark:text-slate-100 truncate">
        Patients Directory
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate hidden md:block">
        Welcome back, Dr. Sarah Mitchell
      </p>
    </div>
    <div className="flex gap-1 sm:gap-2 items-center shrink-0">
      <ThemeToggle />
      <Separator orientation="vertical" className="h-6 hidden sm:block" />
      <Notifications user={user} />
      <Separator orientation="vertical" className="h-6 hidden sm:block" />
      <Link
        to={`/profile/${user.id}`}
        className="flex items-center gap-2 rounded-lg p-1.5 sm:px-2 sm:py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Avatar className="h-8 w-8 rounded-lg shrink-0">
          <AvatarImage src={user.image} />
          <AvatarFallback className="rounded-lg text-primary text-xs font-semibold">SM</AvatarFallback>
        </Avatar>
        <div className="hidden sm:grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-bold text-slate-800 dark:text-slate-100">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground capitalize">{user.role}</span>
        </div>
      </Link>
    </div>
  </div>
</header>
```
