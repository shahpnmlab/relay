using Refund.DataModel;

namespace Refund.Utils;

public static partial class DiagramLayoutComputer
{
    internal static void SimplifyUnobstructedEdges(DiagramLayout layout)
    {
        for (int i = 0; i < layout.Edges.Count; i++)
        {
            var edge = layout.Edges[i];
            if (edge.BendPoints is not { Count: > 0 } || edge.TargetX <= edge.SourceX)
                continue;

            // The direct horizontal-tangent Bezier stays entirely inside the
            // endpoint rectangle. Only discard ELK waypoints when that whole
            // corridor is clear; preserve detours around cards and annotations.
            double top = Math.Min(edge.SourceY, edge.TargetY);
            double bottom = Math.Max(edge.SourceY, edge.TargetY);
            bool Intersects(double x, double y, double width, double height) =>
                x < edge.TargetX && x + width > edge.SourceX &&
                y - 4 <= bottom && y + height + 4 >= top;
            bool IsEndpoint(DiagramLayoutNode node) => !node.IsFolder &&
                (node.IsFactoryInstance ? -node.ItemId : node.ItemId) is var id &&
                (id == edge.SourceJobId || id == edge.TargetJobId);

            if (layout.Nodes.Any(n => !IsEndpoint(n) && Intersects(n.X, n.Y, n.Width, n.Height)) ||
                layout.ExternalConnections.Any(n => Intersects(n.X, n.Y, n.Width, n.Height)))
                continue;

            layout.Edges[i] = edge with { BendPoints = [] };
        }
    }
}
