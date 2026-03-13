const text = `The current system telemetry is not reporting real-time voltage or current readings at this moment. However, I can provide the operational status of the system:

### Current System Status
| Parameter | Current Value |
| :--- | :--- |
| Motor Status | Running |
| Active Valve | 24 (Amla) |
| Timer Remaining | 00:33 min |
| Fertigation | Inactive |`;

function parseMD(html) {
    // 1. Headings (### Text)
    html = html.replace(/^###\s+(.+)$/gm, '<h6 class="mt-3 mb-2 text-info">$1</h6>');
    html = html.replace(/^##\s+(.+)$/gm, '<h5 class="mt-3 mb-2 text-info">$1</h5>');
    html = html.replace(/^#\s+(.+)$/gm, '<h4 class="mt-3 mb-2 text-info">$1</h4>');
    
    // 2. Tables
    const tableRegex = /(\|[^\n]+\|\r?\n)((?:\|[\s:a-zA-Z0-9-]+\|)\r?\n)((?:\|[^\n]+\|\r?\n?)+)/g;
    html = html.replace(tableRegex, (match, headerMatch, dividerMatch, bodyMatch) => {
        const extractCells = (rowStr) => rowStr.split('|').map(s => s.trim()).filter(s => s !== '');
        
        const headers = extractCells(headerMatch);
        const bodyRows = bodyMatch.trim().split('\n').map(extractCells);
        
        let theadHtml = headers.map(h => `<th>${h}</th>`).join('');
        let tbodyHtml = bodyRows.map(row => {
            const cells = row.map(c => `<td>${c}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');
        
        return `<div class="table-responsive my-3"><table class="table table-dark table-hover table-bordered text-center align-middle"><thead><tr>${theadHtml}</tr></thead><tbody>${tbodyHtml}</tbody></table></div>`;
    });
    
    return html;
}

console.log(parseMD(text));
