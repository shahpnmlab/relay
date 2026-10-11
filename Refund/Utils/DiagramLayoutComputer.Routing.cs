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

            // Test the curve itself: a nearby card can occupy the endpoint
            // rectangle without actually obstructing the direct curve.
            double tangent = (edge.TargetX - edge.SourceX) * 0.75;
            var start = (edge.SourceX, edge.SourceY);
            var control1 = (edge.SourceX + tangent, edge.SourceY);
            var control2 = (edge.TargetX - tangent, edge.TargetY);
            var end = (edge.TargetX, edge.TargetY);
            bool Intersects(double x, double y, double width, double height) =>
                CurveIntersectsRectangle(start, control1, control2, end,
                    x - 4, y - 4, x + width + 4, y + height + 4);
            bool IsEndpoint(DiagramLayoutNode node)
            {
                int id = node.IsFactoryInstance ? -node.ItemId : node.ItemId;
                return !node.IsFolder && (id == edge.SourceJobId || id == edge.TargetJobId);
            }

            if (layout.Nodes.Any(n => !IsEndpoint(n) && Intersects(n.X, n.Y, n.Width, n.Height)) ||
                layout.ExternalConnections.Any(n => Intersects(n.X, n.Y, n.Width, n.Height)))
                continue;

            layout.Edges[i] = edge with { BendPoints = [] };
        }
    }
    private static bool CurveIntersectsRectangle(
        (double X, double Y) a, (double X, double Y) b,
        (double X, double Y) c, (double X, double Y) d,
        double left, double top, double right, double bottom, int depth = 0)
    {
        double minX = Math.Min(Math.Min(a.X, b.X), Math.Min(c.X, d.X));
        double maxX = Math.Max(Math.Max(a.X, b.X), Math.Max(c.X, d.X));
        double minY = Math.Min(Math.Min(a.Y, b.Y), Math.Min(c.Y, d.Y));
        double maxY = Math.Max(Math.Max(a.Y, b.Y), Math.Max(c.Y, d.Y));
        if (maxX < left || minX > right || maxY < top || minY > bottom)
            return false;
        // Conservative subpixel termination: unlike sampling, subdivision cannot
        // miss a narrow obstacle between sample points.
        if ((minX >= left && maxX <= right && minY >= top && maxY <= bottom) ||
            depth >= 16 || (maxX - minX <= 0.25 && maxY - minY <= 0.25))
            return true;

        static (double X, double Y) Mid((double X, double Y) p, (double X, double Y) q) =>
            ((p.X + q.X) / 2, (p.Y + q.Y) / 2);
        var ab = Mid(a, b);
        var bc = Mid(b, c);
        var cd = Mid(c, d);
        var abc = Mid(ab, bc);
        var bcd = Mid(bc, cd);
        var center = Mid(abc, bcd);
        return CurveIntersectsRectangle(a, ab, abc, center, left, top, right, bottom, depth + 1) ||
               CurveIntersectsRectangle(center, bcd, cd, d, left, top, right, bottom, depth + 1);
    }

}
