import React from 'react';

// Helper to parse inline styles: **bold**, *italic*, `code`
const renderInline = (text) => {
  if (!text) return null;

  const elements = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      elements.push(text.substring(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      elements.push(
        <strong key={match.index} className="font-semibold text-gray-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      elements.push(
        <em key={match.index} className="italic text-gray-700">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      elements.push(
        <code key={match.index} className="bg-gray-100 text-emerald-800 px-1 py-0.5 rounded text-xs font-mono">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    elements.push(text.substring(lastIdx));
  }

  return elements.length > 0 ? elements : text;
};

// Formats multi-line bot answers into clear headings, bullet points, and numbered lists
const FormattedContent = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const renderedBlocks = [];
  let currentList = [];
  let listType = null; // 'bullet' or 'numbered'

  const flushList = () => {
    if (currentList.length === 0) return;
    const isNumbered = listType === 'numbered';
    renderedBlocks.push(
      <div key={`list-${renderedBlocks.length}`} className="my-2 space-y-1.5">
        {currentList.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2 ${item.isNested ? 'ml-5 text-gray-700' : 'ml-1'}`}
          >
            <span
              className={`shrink-0 font-bold select-none ${
                isNumbered ? 'text-emerald-700 min-w-[20px]' : 'text-emerald-600'
              }`}
            >
              {isNumbered ? `${item.number}.` : '•'}
            </span>
            <div className="flex-1 leading-relaxed text-gray-800">{renderInline(item.text)}</div>
          </div>
        ))}
      </div>
    );
    currentList = [];
    listType = null;
  };

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();

    // Empty line separates paragraphs
    if (!trimmed) {
      flushList();
      return;
    }

    // Horizontal divider: --- or ***
    if (/^(\-\-\-|\*\*\*|___)$/.test(trimmed)) {
      flushList();
      renderedBlocks.push(<hr key={`hr-${idx}`} className="my-3 border-gray-200" />);
      return;
    }

    // Headings: ###, ##, #
    if (trimmed.startsWith('#')) {
      flushList();
      const level = trimmed.match(/^#+/)[0].length;
      const headingText = trimmed.replace(/^#+\s*/, '');
      if (level <= 2) {
        renderedBlocks.push(
          <h3 key={`h-${idx}`} className="font-bold text-base sm:text-lg text-emerald-900 mt-3 mb-1.5 pb-1 border-b border-gray-100">
            {renderInline(headingText)}
          </h3>
        );
      } else {
        renderedBlocks.push(
          <h4 key={`h-${idx}`} className="font-semibold text-sm sm:text-base text-emerald-800 mt-2 mb-1">
            {renderInline(headingText)}
          </h4>
        );
      }
      return;
    }

    // Numbered List: 1. Item or 1) Item
    const numMatch = rawLine.match(/^(\s*)(\d+)[\.\)]\s+(.*)$/);
    if (numMatch) {
      if (listType && listType !== 'numbered') flushList();
      listType = 'numbered';
      const isNested = (numMatch[1] || '').length >= 2;
      currentList.push({
        number: numMatch[2],
        text: numMatch[3],
        isNested
      });
      return;
    }

    // Bullet List: * Item, - Item, • Item
    const bulletMatch = rawLine.match(/^(\s*)[\*\-•]\s+(.*)$/);
    if (bulletMatch) {
      if (listType && listType !== 'bullet') flushList();
      listType = 'bullet';
      const isNested = (bulletMatch[1] || '').length >= 2;
      currentList.push({
        text: bulletMatch[2],
        isNested
      });
      return;
    }

    // Regular paragraph line
    flushList();
    renderedBlocks.push(
      <p key={`p-${idx}`} className="my-1.5 leading-relaxed text-gray-800">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList();
  return <div className="space-y-1">{renderedBlocks}</div>;
};

const MessageBubble = ({ sender, text }) => {
  const isUser = sender === 'user';

  if (isUser) {
    return (
      <div className="self-end max-w-[85%] sm:max-w-[75%] my-1.5">
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl rounded-br-xs shadow-sm break-words text-sm sm:text-base">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="self-start max-w-[95%] sm:max-w-[85%] my-1.5">
      <div className="bg-white border border-gray-200 text-gray-800 p-4 sm:p-5 rounded-2xl rounded-tl-xs shadow-sm break-words text-sm sm:text-base">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-2 pb-1 border-b border-gray-100">
          <span>🌱</span>
          <span>Agri AI Response</span>
        </div>
        <FormattedContent content={text} />
      </div>
    </div>
  );
};

export default MessageBubble;

