import type { DocumentBlock, StyleKey, TableData, ImageData, Metadata, BookMetadata, Footnote, Style } from '../types';

const escapeXml = (text: string): string => {
  if (typeof text !== 'string') return '';
  // Remove zero-width space characters and other problematic control characters
  const cleanedText = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
  return cleanedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const processInlineFormatting = (html: string, footnoteMap: Map<string, { id: string, content: string }>): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Process footnotes first and replace them with a placeholder
    const footnotes = Array.from(tempDiv.querySelectorAll('sup[data-footnote-id]'));
    footnotes.forEach((sup, index) => {
        const id = sup.getAttribute('data-footnote-id');
        const content = sup.getAttribute('data-footnote-content');
        if (id && content) {
            footnoteMap.set(id, { id, content });
            const xref = document.createElement('xref');
            xref.setAttribute('ref-type', 'fn');
            xref.setAttribute('rid', id);
            // The number is visual only, determined by order, not stored here.
            // The serializer will count them later.
            sup.replaceWith(xref);
        }
    });

    let xmlContent = tempDiv.innerHTML;
    // Bold
    xmlContent = xmlContent.replace(/<strong>(.*?)<\/strong>/g, '<bold>$1</bold>');
    xmlContent = xmlContent.replace(/<b>(.*?)<\/b>/g, '<bold>$1</bold>');
    // Italic
    xmlContent = xmlContent.replace(/<em>(.*?)<\/em>/g, '<italic>$1</italic>');
    xmlContent = xmlContent.replace(/<i>(.*?)<\/i>/g, '<italic>$1</italic>');
    // Footnote placeholders
    xmlContent = xmlContent.replace(/<xref (.*?)><\/xref>/g, (match, attrs) => {
      // Re-add number visually based on map order
      const ridMatch = attrs.match(/rid="([^"]+)"/);
      if (ridMatch) {
        const id = ridMatch[1];
        const index = Array.from(footnoteMap.keys()).indexOf(id);
        if (index !== -1) {
          return `<xref ${attrs}>${index + 1}</xref>`;
        }
      }
      return `<xref ${attrs}></xref>`;
    });

    // Strip any remaining HTML tags and escape
    const plainText = xmlContent.replace(/<(?!\/?(bold|italic|xref))[^>]*>/g, '');
    
    // Custom escaping that ignores our allowed tags
    return plainText.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;')
        .replace(/<(?!\/?(bold|italic|xref))/g, '&lt;')
        .replace(/>/g, '&gt;');
};

const isListItem = (style: StyleKey) => style === 'ordered_list_item' || style === 'unordered_list_item';

const getListAttributes = (block: DocumentBlock) => {
    const listType = block.style === 'ordered_list_item' ? 'order' : 'bullet';
    const listAttrs = block.list || {};
    const specUses = [];
    const attributes: Record<string, string> = { 'list-type': listType };

    if (listAttrs.style) {
        specUses.push(listAttrs.style);
    }
    if (listAttrs.reversed) {
        specUses.push('reversed');
    }
    if (listAttrs.start && listAttrs.start !== 1) {
        specUses.push(`start-at-${listAttrs.start}`);
    }

    if (specUses.length > 0) {
        attributes['specific-use'] = specUses.join(' ');
    }
    return attributes;
};


const generateListTree = (listBlocks: DocumentBlock[], format: 'jats' | 'bits', footnoteMap: Map<string, Footnote>) => {
    if (!listBlocks.length) return [];

    const firstBlock = listBlocks[0];
    
    const rootList = { 
        tag: 'list', 
        attributes: getListAttributes(firstBlock),
        children: [] as any[], 
        level: -1 
    };

    const listStack = [rootList];

    listBlocks.forEach(block => {
        const level = block.level || 0;
        let processedContent = processInlineFormatting(block.content, footnoteMap);

        let parentList = listStack[listStack.length - 1];
        while (level < parentList.level) {
            listStack.pop();
            parentList = listStack[listStack.length - 1];
        }

        const listItemNode = { 
            tag: 'list-item', 
            children: [{ tag: 'p', content: processedContent, isHtml: true }] as any[]
        };

        if (level > parentList.level) {
            const newList = { 
                tag: 'list', 
                attributes: getListAttributes(block), 
                children: [listItemNode], 
                level: level 
            };
            const lastListItem = parentList.children[parentList.children.length - 1];
            if (lastListItem) {
               lastListItem.children.push(newList);
            } else {
                parentList.children.push(newList);
            }
            listStack.push(newList);
        } else {
            parentList.children.push(listItemNode);
        }
    });

    return [rootList];
};


const buildXmlFragmentTree = (blocks: DocumentBlock[], format: 'jats' | 'bits', images: Record<string, string>, footnoteMap: Map<string, Footnote>, styles: Record<StyleKey, Style>) => {
    const root = { children: [] as any[], level: -1 }; // Sentinel root for initial section stack
    let sectionStack = [root];

    const tagKey = format === 'jats' ? 'jatsTag' : 'bitsTag';
    const parentKey = format === 'jats' ? 'nestingParentJats' : 'nestingParentBits';

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const style = styles[block.style as StyleKey];
        if (!style) continue;

        const currentSectionOrRoot = sectionStack[sectionStack.length - 1];

        // Handle lists
        if (isListItem(block.style)) {
            let listEndIndex = i;
            while (listEndIndex < blocks.length -1 && isListItem(blocks[listEndIndex + 1].style)) {
                listEndIndex++;
            }
            const listBlocks = blocks.slice(i, listEndIndex + 1);
            const listTree = generateListTree(listBlocks, format, footnoteMap);
            currentSectionOrRoot.children.push(...listTree);
            i = listEndIndex; // Adjust loop counter
            continue;
        }


        // Handle tables
        if (style.key === 'table') {
            try {
                const tableData: TableData = JSON.parse(block.content);
                const tableNode = {
                    tag: style[tagKey], // table-wrap
                    attributes: style.attributes, // Add custom attributes
                    children: [
                        {
                            tag: 'caption',
                            children: [{ tag: 'p', content: escapeXml(tableData.caption) }]
                        },
                        {
                            tag: 'table',
                            children: [
                                { // thead
                                    tag: 'thead',
                                    children: [{
                                        tag: 'tr',
                                        children: tableData.rows[0]?.map(cell => ({ tag: 'th', children: [{tag: 'p', content: processInlineFormatting(cell.content, footnoteMap), isHtml: true}] })) || []
                                    }]
                                },
                                { // tbody
                                    tag: 'tbody',
                                    children: tableData.rows.slice(1).map(row => ({
                                        tag: 'tr',
                                        children: row.map(cell => ({ tag: 'td', children: [{tag: 'p', content: processInlineFormatting(cell.content, footnoteMap), isHtml: true}] }))
                                    }))
                                }
                            ]
                        }
                    ]
                };
                currentSectionOrRoot.children.push(tableNode);
            } catch (e) {
                console.error("Failed to parse table JSON:", e);
            }
            continue; // continue to next block
        }

        // Handle images
        if (style.key === 'image') {
            try {
                const imageData: ImageData = JSON.parse(block.content);
                const mimeType = imageData.src.substring(imageData.src.indexOf(':') + 1, imageData.src.indexOf(';'));
                const extension = mimeType.split('/')[1] || 'png';
                const filename = `image-${block.id}.${extension}`;
                const filepath = `Images/${filename}`;
                
                images[filename] = imageData.src.split(',')[1];

                const imageNode = {
                    tag: style[tagKey], // fig
                    attributes: style.attributes, // Add custom attributes
                    children: [
                        {
                            tag: 'graphic',
                            attributes: { 'xlink:href': filepath }
                        },
                        {
                            tag: 'caption',
                            children: [{ tag: 'p', content: escapeXml(imageData.caption) }]
                        },
                        {
                            tag: 'attrib',
                            content: escapeXml(imageData.source)
                        }
                    ]
                };
                currentSectionOrRoot.children.push(imageNode);
            } catch(e) {
                console.error("Failed to parse image JSON:", e);
            }
            continue; // continue to next block
        }
        
        let content = processInlineFormatting(block.content, footnoteMap);
        let isHtml = true; // Since processInlineFormatting produces XML tags, we treat it as HTML
            
        const element = { tag: style[tagKey], content, attributes: style.attributes, isHtml }; // Pass attributes here

        const isHeading = style.level !== undefined && (style.key.includes('heading') || style.key === 'kapitel' || style.key === 'del');
        const level = style.level ?? 99;

        if (isHeading) {
            // Adjust stack based on current heading level
            let parentLevel = (sectionStack[sectionStack.length - 1] as any).level ?? -1;
            while (level <= parentLevel && sectionStack.length > 1) {
                sectionStack.pop();
                parentLevel = (sectionStack[sectionStack.length - 1] as any).level ?? -1;
            }
            
            // Special handling for BITS chapter: it's a direct child of book-body, not a sec.
            const newSectionTag = (format === 'bits' && style.matterType === 'chapter') ? 'chapter' : (style[parentKey] || 'sec');

            const parentSection = sectionStack[sectionStack.length - 1];
            const newSection = {
                tag: newSectionTag,
                level: style.level,
                attributes: style.attributes, // Add attributes to section tag
                children: [element]
            };

            parentSection.children.push(newSection);
            sectionStack.push(newSection);

        } else if (style[parentKey]) {
            const parentTag = style[parentKey];
            const lastChild = currentSectionOrRoot.children[currentSectionOrRoot.children.length - 1];
            
            if (lastChild && lastChild.tag === parentTag && !lastChild.content && Array.isArray(lastChild.children)) {
                lastChild.children.push(element);
            } else {
                const parentElement = {
                    tag: parentTag,
                    attributes: style.attributes, // Add attributes to parent tag
                    children: [element]
                };
                currentSectionOrRoot.children.push(parentElement);
            }
        } else {
            currentSectionOrRoot.children.push(element);
        }
    };

    return root.children;
}

const renderXml = (nodes: any[], indent = ''): string => {
    return nodes.map(node => {
        if (!node || !node.tag) return '';
        const attrsString = node.attributes ? Object.entries(node.attributes).map(([key, value]) => `${key}="${escapeXml(value as string)}"`).join(' ') : '';
        const attrs = attrsString ? ` ${attrsString}` : '';

        if (node.content && node.children && node.children.length > 0) {
             console.error("Node cannot have both content and children", node);
             // Defaulting to children
             node.content = undefined;
        }

        if (node.children && node.children.length > 0) {
            return `${indent}<${node.tag}${attrs}>\n${renderXml(node.children, indent + '  ')}\n${indent}</${node.tag}>`;
        }

        if (node.tag === 'graphic') { // Self-closing tag
            return `${indent}<${node.tag}${attrs}/>`;
        }
        
        return `${indent}<${node.tag}${attrs}>${node.isHtml ? node.content : (node.content || '')}</${node.tag}>`;
    }).join('\n');
}

const generateFootnoteGroupXml = (footnoteMap: Map<string, Footnote>, indent: string): string => {
    if (footnoteMap.size === 0) return '';
    const fnItems = Array.from(footnoteMap.entries()).map(([id, footnote]) => 
        `${indent}  <fn id="${id}">\n${indent}    <p>${escapeXml(footnote.content)}</p>\n${indent}  </fn>`
    ).join('\n');
    return `${indent}<fn-group>\n${fnItems}\n${indent}</fn-group>`;
};

export const generateJatsXml = (blocks: DocumentBlock[], metadata: Metadata, styles: Record<StyleKey, Style>): { xmlString: string, images: Record<string, string> } => {
    const images: Record<string, string> = {};
    const footnoteMap = new Map<string, Footnote>();
    
    const titleContent = metadata.title;
    const subtitleContent = metadata.subtitle;

    let titleGroupXml = `        <article-title>${escapeXml(titleContent.replace(/<[^>]*>?/gm, ''))}</article-title>`;
    if (subtitleContent) {
        titleGroupXml += `\n        <subtitle>${escapeXml(subtitleContent.replace(/<[^>]*>?/gm, ''))}</subtitle>`;
    }
    
    const authorsXml = (metadata.authors || []).map(author => `        <contrib contrib-type="author">
          <name>
            <surname>${escapeXml(author.lastName)}</surname>
            <given-names>${escapeXml(author.firstName)}</given-names>
          </name>
        </contrib>`).join('\n');

    // JATS: Abstract is part of front matter
    const abstractBlocks = blocks.filter(b => styles[b.style]?.matterType === 'front' || b.style === 'abstract' || b.style === 'abstract_heading');
    const abstractTree = buildXmlFragmentTree(abstractBlocks, 'jats', images, footnoteMap, styles);
    const abstractXml = renderXml(abstractTree, '      ');

    // JATS: All other content is typically body matter
    const bodyContentBlocks = blocks.filter(b => 
        !(['abstract', 'abstract_heading'].includes(b.style)) &&
        styles[b.style]?.matterType !== 'front' && // Exclude explicit frontmatter already handled
        styles[b.style]?.matterType !== 'back' // Exclude explicit backmatter
    );
    const bodyTree = buildXmlFragmentTree(bodyContentBlocks, 'jats', images, footnoteMap, styles);
    const bodyXml = renderXml(bodyTree, '    ');

    // JATS: Back matter (e.g., references, appendices, currently not explicitly categorized in blocks)
    const backMatterBlocks = blocks.filter(b => styles[b.style]?.matterType === 'back');
    const backTree = buildXmlFragmentTree(backMatterBlocks, 'jats', images, footnoteMap, styles);
    const backXml = renderXml(backTree, '    ');
    
    const footnoteGroupXml = generateFootnoteGroupXml(footnoteMap, '    ');

    const jatsXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Publishing DTD v1.2 20190208//EN" "JATS-journalpublishing1.dtd">
<article xmlns:xlink="http://www.w3.org/1999/xlink" article-type="research-article">
  <front>
    <journal-meta>
      <journal-id>Sample Journal</journal-id>
      <issn>1234-5678</issn>
    </journal-meta>
    <article-meta>
      <title-group>
${titleGroupXml}
      </title-group>
      <contrib-group>
${authorsXml}
      </contrib-group>
${abstractXml ? `\n    <abstract>\n${abstractXml}\n    </abstract>` : ''}
    </article-meta>
  </front>
  <body>
${bodyXml}
  </body>
  <back>
${backXml ? `\n${backXml}` : ''}
${footnoteGroupXml ? `\n${footnoteGroupXml}`: ''}
    <ref-list>
      <title>References</title>
    </ref-list>
  </back>
</article>`;

    return { xmlString: jatsXml.replace(/^\s*\n/gm, ''), images };
};


export const generateBitsXml = (blocks: DocumentBlock[], metadata: Metadata, styles: Record<StyleKey, Style>): { xmlString: string, images: Record<string, string> } => {
    const bookMeta = metadata as BookMetadata;
    const images: Record<string, string> = {};
    const footnoteMap = new Map<string, Footnote>();

    const titleContent = bookMeta.title;
    const subtitleContent = bookMeta.subtitle;

    let titleGroupXml = `      <book-title>${escapeXml(titleContent.replace(/<[^>]*>?/gm, ''))}</book-title>`;
    if (subtitleContent) {
        titleGroupXml += `\n      <subtitle>${escapeXml(subtitleContent.replace(/<[^>]*>?/gm, ''))}</subtitle>`;
    }

    const authorsXml = (bookMeta.authors || []).map(author => `      <contrib contrib-type="author">
        <name>
          <surname>${escapeXml(author.lastName)}</surname>
          <given-names>${escapeXml(author.firstName)}</given-names>
        </name>
      </contrib>`).join('\n');

    let extraMetaXml = [];
    if (bookMeta.pIsbn) {
        extraMetaXml.push(`    <isbn publication-format="print">${escapeXml(bookMeta.pIsbn)}</isbn>`);
    }
    if (bookMeta.eIsbn) {
        extraMetaXml.push(`    <isbn publication-format="electronic">${escapeXml(bookMeta.eIsbn)}</isbn>`);
    }
    if (bookMeta.publicationDate) {
        const [year, month, day] = bookMeta.publicationDate.split('-');
        extraMetaXml.push(`    <pub-date>
      <day>${day}</day>
      <month>${month}</month>
      <year>${year}</year>
    </pub-date>`);
    }
    if (bookMeta.edition) {
        extraMetaXml.push(`    <edition>${escapeXml(bookMeta.edition)}</edition>`);
    }
    if (bookMeta.bookType) {
        extraMetaXml.push(`    <custom-meta-group>
      <custom-meta>
        <meta-name>Bogtype</meta-name>
        <meta-value>${escapeXml(bookMeta.bookType)}</meta-value>
      </custom-meta>
    </custom-meta-group>`);
    }
    if (bookMeta.coverImageSrc) {
        const mimeType = bookMeta.coverImageSrc.substring(bookMeta.coverImageSrc.indexOf(':') + 1, bookMeta.coverImageSrc.indexOf(';'));
        const extension = mimeType.split('/')[1] || 'png';
        const filename = `cover.${extension}`;
        const filepath = `Images/${filename}`;
        images[filename] = bookMeta.coverImageSrc.split(',')[1];
        
        extraMetaXml.push(`    <custom-meta-group>
      <custom-meta>
        <meta-name>cover-image</meta-name>
        <meta-value>${escapeXml(filepath)}</meta-value>
      </custom-meta>
    </custom-meta-group>`);
    }

    let descriptionXml = '';
    if (bookMeta.description) {
        descriptionXml = `    <abstract abstract-type="description">
      <p>${escapeXml(bookMeta.description)}</p>
    </abstract>`;
    }

    // BITS: Front matter blocks (e.g., abstracts, dedication) go into <book-meta>
    const frontMatterBlocks = blocks.filter(b => styles[b.style]?.matterType === 'front');
    const frontMatterTree = buildXmlFragmentTree(frontMatterBlocks, 'bits', images, footnoteMap, styles);
    const frontMatterXml = renderXml(frontMatterTree, '    ');

    // BITS: Body matter blocks, specifically handling chapters
    const bodyMatterBlocks = blocks.filter(b => 
        styles[b.style]?.matterType === 'body' || 
        styles[b.style]?.matterType === 'chapter' ||
        (!styles[b.style]?.matterType && !isListItem(b.style) && !(['abstract', 'abstract_heading'].includes(b.style)))
    );

    let bodyXmlContent = '';
    let currentChapterBlocks: DocumentBlock[] = [];
    
    // Group blocks into chapters or direct body content
    for (let i = 0; i < bodyMatterBlocks.length; i++) {
        const block = bodyMatterBlocks[i];
        const style = styles[block.style];

        if (style?.matterType === 'chapter') {
            if (currentChapterBlocks.length > 0) {
                // Render the previous chapter's content
                const chapterTree = buildXmlFragmentTree(currentChapterBlocks, 'bits', images, footnoteMap, styles);
                bodyXmlContent += renderXml(chapterTree, '    ') + '\n';
            }
            // Start a new chapter
            currentChapterBlocks = [block];
        } else {
            // Add block to current chapter or to general body if no chapter started
            currentChapterBlocks.push(block);
        }
    }
    // Render the last chapter/body content
    if (currentChapterBlocks.length > 0) {
        const chapterTree = buildXmlFragmentTree(currentChapterBlocks, 'bits', images, footnoteMap, styles);
        bodyXmlContent += renderXml(chapterTree, '    ') + '\n';
    }

    // BITS: Back matter blocks
    const backMatterBlocks = blocks.filter(b => styles[b.style]?.matterType === 'back');
    const backMatterTree = buildXmlFragmentTree(backMatterBlocks, 'bits', images, footnoteMap, styles);
    const backMatterXml = renderXml(backMatterTree, '    ');
    
    const footnoteGroupXml = generateFootnoteGroupXml(footnoteMap, '    ');

    const bitsXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE book PUBLIC "-//NLM//DTD BITS Book Interchange DTD v2.0 20151225//EN" "BITS-book2.dtd">
<book xmlns:xlink="http://www.w3.org/1999/xlink">
  <book-meta>
    <book-title-group>
${titleGroupXml}
    </book-title-group>
    <contrib-group>
${authorsXml}
    </contrib-group>
${extraMetaXml.join('\n')}
${descriptionXml ? `\n${descriptionXml}`: ''}
${frontMatterXml ? `\n${frontMatterXml}` : ''}
  </book-meta>
  <book-body>
${bodyXmlContent}
  </book-body>
  <book-back>
${backMatterXml ? `\n${backMatterXml}` : ''}
${footnoteGroupXml ? `\n${footnoteGroupXml}`: ''}
  </book-back>
</book>`;

    return { xmlString: bitsXml.replace(/^\s*\n/gm, ''), images };
};