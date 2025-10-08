/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";

// Allow TypeScript to recognize the global variables from the CDN scripts
declare var marked: { parse: (markdown: string) => string; setOptions: (options: any) => void; };
declare var hljs: { highlightElement: (element: HTMLElement) => void; getLanguage: (lang: string) => boolean; highlight: (code: string, options: { language: string }) => { value: string }; };
// FIX: Declare d3 as a global variable to resolve 'Cannot find name 'd3'' errors.
declare var d3: any;

// This data is derived from the 'webdev-ai.sh' script provided by the user.
// It visualizes the file and directory structure created by the script.
const projectData = {
  name: "webdev-ai-engine",
  children: [
    {
      name: "webdev-ai.sh",
      content: `#!/usr/bin/env bash
set -euo pipefail

# ███████╗██╗   ██╗███████╗ ██████╗ ██████╗ █████╗ ██╗    ██████╗ ██████╗ ██████╗ ███████╗
# ██╔════╝╚██╗ ██╔╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗██║    ██╔══██╗██╔══██╗██╔══██╗██╔════╝
# ███████╗ ╚████╔╝ █████╗  ██║   ██║██████╔╝███████║██║    ██║  ██║██████╔╝██████╔╝█████╗  
# ╚════██║  ╚██╔╝  ██╔══╝  ██║   ██║██╔═══╝ ██╔══██║██║    ██║  ██║██╔═══╝ ██╔═══╝ ██╔══╝  
# ███████║   ██║   ███████╗╚██████╔╝██║     ██║  ██║███████╗██████╔╝██║     ██║     ███████