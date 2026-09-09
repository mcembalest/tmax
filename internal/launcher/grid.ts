// Fill an aligned grid without replacing terminals or moving the user's focus.
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
export default function grids(pi: ExtensionAPI, run: (args: string[], signal?: AbortSignal) => Promise<string>) {
  pi.registerTool({
    name: 'workspace_grid', label: 'Arrange panels',
    description: 'Arrange the current tab into rows and columns in one operation, adding shells as needed. Preserves existing terminals and focus. Already complete grids do nothing. Does not close excess panels or rearrange incompatible existing splits.',
    parameters: Type.Object({ rows: Type.Integer({ minimum: 1, maximum: 4 }), columns: Type.Integer({ minimum: 1, maximum: 4 }) }),
    async execute(_id, {rows, columns}, signal, _update, ctx) {
      if (signal?.aborted) throw new Error('Canceled before arranging panels');
      const api = async (args: string[]) => JSON.parse(await run(args, signal)).result;
      const layout = (await api(['pane','layout','--current'])).layout;
      const area = layout.area;
      const cells = layout.panes.map((p: any) => {
        const r = p.rect;
        const x = Math.round((r.x-area.x)*columns/area.width), y = Math.round((r.y-area.y)*rows/area.height);
        const right = Math.round((r.x+r.width-area.x)*columns/area.width), bottom = Math.round((r.y+r.height-area.y)*rows/area.height);
        const close = (actual: number, expected: number) => Math.abs(actual-expected) <= 1;
        if (right<=x || bottom<=y || !close(r.x,area.x+x*area.width/columns) || !close(r.y,area.y+y*area.height/rows) || !close(r.x+r.width,area.x+right*area.width/columns) || !close(r.y+r.height,area.y+bottom*area.height/rows))
          throw new Error('Existing splits do not align with this grid. Inspect the layout; no panels were changed.');
        return {id:p.pane_id, width:right-x, height:bottom-y};
      });
      async function fill(id: string, width: number, height: number): Promise<void> {
        if (signal?.aborted) throw new Error('Canceled; inspect the remaining layout before retrying');
        if (width===1 && height===1) return;
        const horizontal=width>1, n=horizontal?width:height, first=Math.floor(n/2);
        const result=await api(['pane','split',id,'--direction',horizontal?'right':'down','--ratio',String(first/n),'--cwd',ctx.cwd,'--no-focus']);
        await fill(id,horizontal?first:width,horizontal?height:first);
        await fill(result.pane.pane_id,horizontal?n-first:width,horizontal?height:n-first);
      }
      for (const cell of cells) await fill(cell.id,cell.width,cell.height);
      if (layout.zoomed) await api(['pane','zoom','--current','--off']);
      return {content:[{type:'text',text:JSON.stringify((await api(['pane','layout','--current'])).layout)}],details:{}};
    },
  });
}
