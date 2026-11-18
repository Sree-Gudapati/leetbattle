'use client';
import Editor, { type Monaco as MonacoApi } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { useEditor } from '../context';
import { MONACO_THEME, buildMonacoTheme, readThemeColors } from '../monaco-theme';

// Defines (or redefines) the editor theme from the site's current colors and switches to it.
function applyTheme(monaco: MonacoApi) {
	const root = document.documentElement;
	monaco.editor.defineTheme(MONACO_THEME, buildMonacoTheme(readThemeColors(root), root.getAttribute('data-mode')));
	monaco.editor.setTheme(MONACO_THEME);
}

export default function Monaco() {
	const { code, setCode, readOnly } = useEditor();
	const monacoRef = useRef<MonacoApi | null>(null);

	// Settings changes data-scheme and data-mode on <html>; restyle the editor when it does.
	useEffect(() => {
		const observer = new MutationObserver(() => {
			if (monacoRef.current) {
				applyTheme(monacoRef.current);
			}
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme', 'data-mode'] });
		return () => observer.disconnect();
	}, []);

	return (
		<Editor
			height="100%"
			defaultLanguage="python"
			value={code}
			theme={MONACO_THEME}
			beforeMount={(monaco) => {
				monacoRef.current = monaco;
				applyTheme(monaco);
			}}
			onChange={(value) => setCode(value ?? '')}
			options={{ minimap: { enabled: false }, fontSize: 14, readOnly }}
		/>
	);
}
