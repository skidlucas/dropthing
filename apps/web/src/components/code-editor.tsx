import CodeMirror from '@uiw/react-codemirror';
import { dropTheme } from '@/lib/editor-theme';
import { languages } from '@codemirror/language-data';
import { useState, useEffect } from 'react';
import { Select } from '@base-ui-components/react/select';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  onLanguageChange?: (language: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
}

export function CodeEditor({
  value,
  onChange,
  language,
  onLanguageChange,
  readOnly = false,
  placeholder,
  minHeight = '200px',
  maxHeight,
}: CodeEditorProps) {
  const [langExtension, setLangExtension] = useState<Extension | null>(null);

  useEffect(() => {
    if (!language) {
      setLangExtension(null);
      return;
    }
    const desc = languages.find(
      (l) => l.name === language || l.alias.some((a) => a.toLowerCase() === language.toLowerCase())
    );
    if (desc) {
      desc.load().then(setLangExtension);
    } else {
      setLangExtension(null);
    }
  }, [language]);

  const ariaLabel = EditorView.contentAttributes.of({
    'aria-label': readOnly ? 'Code preview' : 'Code editor',
  });

  const extensions = [ariaLabel, ...(langExtension ? [langExtension] : [])];

  const optionalProps = {
    ...(onChange != null ? { onChange } : {}),
    ...(placeholder != null ? { placeholder } : {}),
    ...(maxHeight != null ? { maxHeight } : {}),
  };

  return (
    <div className="relative">
      <CodeMirror
        value={value}
        theme={dropTheme}
        extensions={extensions}
        readOnly={readOnly}
        editable={!readOnly}
        minHeight={minHeight}
        basicSetup={{
          lineNumbers: true,
          foldGutter: !readOnly,
          highlightActiveLine: !readOnly,
        }}
        className="rounded-lg overflow-hidden border border-neutral-700 text-sm"
        {...optionalProps}
      />
      {onLanguageChange && (
        <div className="absolute bottom-2 right-2 z-10">
          <Select.Root
            value={language ?? ''}
            onValueChange={(value) => onLanguageChange(value ?? '')}
          >
            <Select.Trigger
              aria-label="Select language"
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-neutral-400 hover:text-neutral-300 bg-neutral-800/80 backdrop-blur-sm border border-neutral-700/50 transition-colors cursor-pointer"
            >
              <Select.Value>{(value: string) => value || 'Plain Text'}</Select.Value>
              <Select.Icon className="text-neutral-600">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner side="top" align="end" sideOffset={4} className="z-50">
                <Select.Popup className="max-h-60 overflow-y-auto rounded-lg bg-neutral-800 border border-neutral-700 p-1 shadow-xl">
                  <Select.Item
                    value=""
                    className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-neutral-300 outline-none data-[highlighted]:bg-neutral-700 cursor-default"
                  >
                    <Select.ItemText>Plain Text</Select.ItemText>
                  </Select.Item>
                  {languages.map((l) => (
                    <Select.Item
                      key={l.name}
                      value={l.name}
                      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-neutral-300 outline-none data-[highlighted]:bg-neutral-700 cursor-default"
                    >
                      <Select.ItemText>{l.name}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      )}
    </div>
  );
}

export { languages };
