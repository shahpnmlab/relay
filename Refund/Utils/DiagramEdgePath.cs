using System.Globalization;
using Refund.DataModel;

namespace Refund.Utils;

/// <summary>SVG dependency curves with horizontal port tangents and rounded detours.</summary>
public static class DiagramEdgePath
{
    // Build SVG bezier path from polyline bend points
    public static string Build(DiagramLayoutEdge edge)
    {
        var pts = new List<(double X, double Y)> { (edge.SourceX, edge.SourceY) };
        if (edge.BendPoints != null)
            foreach (var bp in edge.BendPoints)
                pts.Add(bp);
        pts.Add((edge.TargetX, edge.TargetY));

        // Repeated routing points have no direction and would prevent corner rounding.
        pts = pts.Where((p, i) => i == 0 || p != pts[i - 1]).ToList();

        // The local annotation detours contain vertical segments. Round those
        // routes with tangent quadratic joins instead of joining independent
        // horizontal-tangent Beziers at right angles. Keep ordinary flowing
        // dependency curves unchanged.
        if (pts.Zip(pts.Skip(1)).Any(pair =>
                Math.Abs(pair.First.X - pair.Second.X) < 0.01 &&
                Math.Abs(pair.First.Y - pair.Second.Y) > 0.01))
            return GetRoundedPath(pts);

        var sb = new System.Text.StringBuilder();
        sb.Append($"M {F(pts[0].X)},{F(pts[0].Y)}");
        for (int i = 0; i < pts.Count - 1; i++)
        {
            var p1 = pts[i];
            var p2 = pts[i + 1];
            double tangent = (p2.X - p1.X) * 0.75;
            sb.Append($" C {F(p1.X + tangent)},{F(p1.Y)} {F(p2.X - tangent)},{F(p2.Y)} {F(p2.X)},{F(p2.Y)}");
        }
        return sb.ToString();
    }

    private static string GetRoundedPath(List<(double X, double Y)> points)
    {
        // A rounded polyline otherwise inherits its endpoint directions from the
        // first/last routing segment, which may be diagonal when only the other
        // end has an annotation detour. Give both ports a short horizontal lead.
        var source = points[0];
        var target = points[^1];
        if (points[1].Y != source.Y || points[1].X <= source.X)
            points.Insert(1, (source.X + LeadLength(source, points[1]), source.Y));
        if (points[^2].Y != target.Y || points[^2].X >= target.X)
            points.Insert(points.Count - 1, (target.X - LeadLength(target, points[^2]), target.Y));

        // Trimming each adjacent segment by at most half its length prevents
        // rounding from overshooting the reserved routing corridor.
        var path = new System.Text.StringBuilder($"M {F(points[0].X)},{F(points[0].Y)}");
        for (int i = 1; i < points.Count - 1; i++)
        {
            var previous = points[i - 1];
            var corner = points[i];
            var next = points[i + 1];
            double incoming = Math.Sqrt(Math.Pow(corner.X - previous.X, 2) + Math.Pow(corner.Y - previous.Y, 2));
            double outgoing = Math.Sqrt(Math.Pow(next.X - corner.X, 2) + Math.Pow(next.Y - corner.Y, 2));
            if (incoming < 0.01 || outgoing < 0.01) continue;
            double radius = Math.Min(16, Math.Min(incoming, outgoing) / 2);
            double entryX = corner.X + (previous.X - corner.X) * radius / incoming;
            double entryY = corner.Y + (previous.Y - corner.Y) * radius / incoming;
            double exitX = corner.X + (next.X - corner.X) * radius / outgoing;
            double exitY = corner.Y + (next.Y - corner.Y) * radius / outgoing;
            path.Append($" L {F(entryX)},{F(entryY)} Q {F(corner.X)},{F(corner.Y)} {F(exitX)},{F(exitY)}");
        }
        path.Append($" L {F(points[^1].X)},{F(points[^1].Y)}");
        return path.ToString();
    }

    private static double LeadLength((double X, double Y) port, (double X, double Y) next) =>
        Math.Min(12, Math.Sqrt(Math.Pow(next.X - port.X, 2) + Math.Pow(next.Y - port.Y, 2)) / 3);

    private static string F(double value) => value.ToString("F1", CultureInfo.InvariantCulture);
}
