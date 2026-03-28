import CodeMirror from '@uiw/react-codemirror';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import { languages } from '@codemirror/language-data';
import { useState, useEffect } from 'react';
import type { Extension } from '@codemirror/state';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
}

export function CodeEditor({
  value,
  onChange,
  language,
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

  const optionalProps = {
    ...(onChange != null ? { onChange } : {}),
    ...(placeholder != null ? { placeholder } : {}),
    ...(maxHeight != null ? { maxHeight } : {}),
  };

  return (
    <CodeMirror
      value={value}
      theme={tokyoNight}
      extensions={langExtension ? [langExtension] : []}
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
  );
}

export { languages };
