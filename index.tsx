/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";

// Allow TypeScript to recognize the global variables from the CDN scripts
declare var marked: { parse: (markdown: string) => string };
declare var hljs: { highlightElement: (element: HTMLElement) => void };

// In a real application, this data would be fetched from a backend API
// that analyzes the actual project directory.
const projectData = {
  name: "project-root",
  children: [
    {
      name: "src",
      children: [
        {
          name: "components",
          children: [
            { name: "Button.tsx", content: `import React from 'react';\nimport './Button.css';\n\nconst Button = ({ children, onClick }) => <button className="btn" onClick={onClick}>{children}</button>;\n\nexport default Button;` },
            { name: "Button.css", content: `.btn { background-color: #58a6ff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }` },
            { name: "Card.tsx", content: `import React from 'react';\nimport './Card.css';\n\nconst Card = ({ title, children }) => <div className="card"><h3>{title}</h3><p>{children}</p></div>;\n\nexport default Card;` },
            { name: "Card.css", content: `.card { padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }` },
          ],
        },
        {
          name: "hooks",
          children: [{ name: "useApi.ts", content: `import { useState, useEffect } from 'react';\n\nfunction useApi(url) {\n  const [data, setData] = useState(null);\n  useEffect(() => {\n    fetch(url).then(res => res.json()).then(setData);\n  }, [url]);\n  return data;\n}` }],
        },
        { name: "index.tsx", content: `// Main application entry point.` },
        { name: "index.css", content: `/* Global styles for the application */` },
      ],
    },
    {
      name: "public",
      children: [{ name: "index.html", content: `<!DOCTYPE html><html>...</html>` }, { name: "favicon.ico" }],
    },
    { name: "package.json", content: `{ "name": "project-visualizer", "version": "1.0.0" }` },
    { name: "package-lock.json" },
    { name: "README.md", content: `# Project Structure Visualizer\n\nThis application visualizes a project's file structure and provides AI-powered summaries for file contents.` },
  ],
};

const getFileColor = (filename) => {
  if (!filename.includes(".")) return "var(--color-dir)";
  const extension = filename.split(".").pop();
  switch (extension) {
    case "js":
    case "ts":
    case "tsx":
      return "var(--color-js)";
    case "json":
      return "var(--color-json)";
    case "css":
    case "scss":
      return "var(--color-css)";
    case "html":
      return "var(--color-html)";
    case "md":
      return "var(--color-md)";
    default:
      return "var(--color-other)";
  }
};

const Legend = () => (
  <div className="legend">
    <h3>File Types</h3>
    <div className="legend-item">
      <div className="legend-color" style={{ backgroundColor: 'var(--color-dir)' }}></div>
      <span>Directory</span>
    </div>
    <div className="legend-item">
      <div className="legend-color" style={{ backgroundColor: 'var(--color-js)' }}></div>
      <span>JavaScript/TypeScript</span>
    </div>
    <div className="legend-item">
      <div className="legend-color" style={{ backgroundColor: 'var(--color-json)' }}></div>
      <span>JSON</span>
    </div>
    <div className="legend-item">
      <div className="legend-color" style={{ backgroundColor: 'var(--color-css)' }}></div>
      <span>CSS/SCSS</span>
    </div>
    <div className="legend-item">
      <div className="legend-color" style={{ backgroundColor: 'var(--color-html)' }}></div>
      <span>HTML</span>
    </div>
     <div className="legend-item">
      <div className="legend-color" style={{ backgroundColor: 'var(--color-md)' }}></div>
      <span>Markdown</span>
    </div>
    <div className="legend-item">
      <div className="legend-color" style={{ backgroundColor: 'var(--color-other)' }}></div>
      <span>Other</span>
    </div>
  </div>
);

const ContentViewer = ({ file }) => {
  const codeRef = useRef(null);
  
  const getLanguage = (filename) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'tsx': return 'typescript';
      case 'css': return 'css';
      case 'json': return 'json';
      case 'html': return 'xml'; // Use xml for html highlighting
      case 'md': return 'markdown';
      default: return 'plaintext';
    }
  };

  const lang = getLanguage(file.name);

  useEffect(() => {
    if (codeRef.current && hljs) {
      hljs.highlightElement(codeRef.current);
    }
  }, [file.content, lang]);

  if (!file.content) {
    return <p style={{ fontStyle: 'italic', color: 'var(--color-other)' }}>No content to display.</p>;
  }

  if (lang === 'markdown' && marked) {
    const html = marked.parse(file.content);
    return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  
  return (
    <pre>
      <code ref={codeRef} className={`language-${lang} hljs`}>
        {file.content}
      </code>
    </pre>
  );
};


const DetailsPanel = ({ node, summary, isLoading, onClose }) => {
  if (!node) return null;

  const getFileType = (node) => {
    if (node.children || node._children) return "Directory";
    return "File";
  };

  const getExtension = (name) => {
    if (!name.includes(".")) return "N/A";
    return name.split(".").pop();
  };

  return (
    <div className="details-panel" role="complementary" aria-labelledby="details-heading">
      <button onClick={onClose} className="close-btn" aria-label="Close panel">&times;</button>
      <h2 id="details-heading">{node.data.name}</h2>
      <div className="details-grid">
        <span>Type</span>
        <span>{getFileType(node)}</span>
        <span>Path</span>
        <span>{node.ancestors().reverse().map(d => d.data.name).join('/')}</span>
        {getFileType(node) === 'File' && (
          <>
            <span>Extension</span>
            <span>{getExtension(node.data.name)}</span>
          </>
        )}
        {node.children && (
           <>
            <span>Contains</span>
            <span>{node.children.length} items</span>
          </>
        )}
      </div>
      {node.data.content && (
        <div className="ai-summary">
          <h3>AI Content Summary</h3>
          {isLoading ? (
            <div className="spinner" role="status" aria-label="Loading summary"></div>
          ) : (
            <p>{summary || "Could not generate summary."}</p>
          )}
        </div>
      )}
      {node.data.content && (
        <div className="content-viewer">
          <h3>File Content</h3>
          <ContentViewer file={node.data} />
        </div>
      )}
    </div>
  );
};


const TreeChart = ({ data, onNodeClick }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous renders

    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;
    
    const root = d3.hierarchy(data);
    const dx = 20;
    const dy = width / (root.height + 2); // Give more space
    const tree = d3.tree().nodeSize([dx, dy]);
    
    tree(root);

    let x0 = Infinity;
    let x1 = -x0;
    root.each(d => {
      if (d.x > x1) x1 = d.x;
      if (d.x < x0) x0 = d.x;
    });

    const g = svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("transform", `translate(${dy / 2},${height / 2})`);

    g.append("g")
      .attr("fill", "none")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 1.5)
    .selectAll("path")
      .data(root.links())
      .join("path")
        .attr("class", "link")
        .attr("d", d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x));
    
    const node = g.append("g")
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 3)
    .selectAll("g")
      .data(root.descendants())
      .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`)
        .on('click', (event, d) => {
            event.stopPropagation();
            onNodeClick(d);
        });

    node.append("circle")
        .attr("fill", d => getFileColor(d.data.name))
        .attr("r", 5);

    node.append("text")
        .attr("dy", "0.31em")
        .attr("x", d => d.children ? -8 : 8)
        .attr("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name);

    // Zoom and pan
    const zoom = d3.zoom()
        .scaleExtent([0.1, 5])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    
    svg.call(zoom);

  }, [data, onNodeClick]);

  return (
    <div className="visualization-container">
      <svg ref={svgRef}></svg>
      <Legend />
    </div>
  );
};

const App = () => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchSummary = useCallback(async (node) => {
    if (!node?.data?.content) return;

    setIsLoading(true);
    setSummary("");

    try {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama2",
          prompt: `Provide a one-sentence summary for a file named "${node.data.name}" with the following content:\n\n${node.data.content}`,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      setSummary(data.response.trim());
    } catch (error) {
      console.error("Failed to fetch summary from Ollama:", error);
      setSummary("Failed to generate summary. Make sure Ollama is running and the 'llama2' model is available.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    if (node?.data?.content) {
      fetchSummary(node);
    } else {
        setSummary("");
    }
  }, [fetchSummary]);

  const handleClosePanel = () => {
    setSelectedNode(null);
  };

  return (
    <>
      <header>
        <h1>Project Structure Visualizer</h1>
      </header>
      <div className={`main-container ${selectedNode ? 'panel-open' : ''}`}>
        <TreeChart data={projectData} onNodeClick={handleNodeClick} />
        <DetailsPanel 
            node={selectedNode} 
            summary={summary} 
            isLoading={isLoading} 
            onClose={handleClosePanel} 
        />
      </div>
    </>
  );
};

const root = createRoot(document.getElementById("root"));
root.render(<App />);