using System.Globalization;
using System.Text.RegularExpressions;
using Refund.DataModel;
using Refund.Utils;

namespace Refund.Tests.Services;

public sealed class DiagramEdgePathTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void OneSidedDetourKeepsBothPortTangentsHorizontal(bool reverse)
    {
        // A diagonal source segment followed by a vertical destination detour,
        // as in the reported diagram. Mirroring covers the opposite endpoint.
        var points = new (double X, double Y)[]
        {
            (100, 200), (250, 40), (400, 40), (400, 100), (420, 100)
        };
        if (reverse)
            points = points.Reverse().Select(p => (520 - p.X, p.Y)).ToArray();
        var path = DiagramEdgePath.Build(new DiagramLayoutEdge
        {
            SourceX = points[0].X, SourceY = points[0].Y,
            TargetX = points[^1].X, TargetY = points[^1].Y,
            BendPoints = points[1..^1]
        });
        var commands = Regex.Matches(path, @"([MLQ]) ([\d., -]+)").Cast<Match>().ToList();
        static double[] Values(Match command) => command.Groups[2].Value
            .Split(new[] { ',', ' ' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(v => double.Parse(v, CultureInfo.InvariantCulture)).ToArray();

        var first = Values(commands[1]);
        Assert.Equal("L", commands[1].Groups[1].Value);
        Assert.Equal(points[0].Y, first[1]);
        Assert.True(first[0] > points[0].X);
        var penultimate = Values(commands[^2]);
        Assert.Equal(points[^1].Y, penultimate[^1]);
        Assert.True(penultimate[^2] < points[^1].X);
        Assert.Equal(new[] { points[^1].X, points[^1].Y }, Values(commands[^1]));
        Assert.Contains(" Q ", path); // Intermediate corners remain curved.
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public void RedundantHumpIsRemovedOnlyWhenItsCorridorIsClear(bool cardObstacle, bool externalObstacle)
    {
        var bends = new (double X, double Y)[] { (150, 20), (250, 20) };
        var layout = new DiagramLayout
        {
            Nodes = [
                new() { ItemId = 1, X = 0, Y = 150, Width = 100, Height = 100 },
                new() { ItemId = 2, X = 400, Y = 50, Width = 100, Height = 100 }
            ],
            Edges = [new() {
                SourceJobId = 1, TargetJobId = 2,
                SourceX = 100, SourceY = 200, TargetX = 400, TargetY = 100,
                BendPoints = bends
            }]
        };
        if (cardObstacle)
            layout.Nodes.Add(new() { ItemId = 3, X = 200, Y = 130, Width = 40, Height = 40 });
        if (externalObstacle)
            layout.ExternalConnections.Add(new() { X = 200, Y = 130, Width = 40, Height = 40 });

        DiagramLayoutComputer.SimplifyUnobstructedEdges(layout);

        if (cardObstacle || externalObstacle)
            Assert.Equal(bends, layout.Edges[0].BendPoints);
        else
        {
            Assert.Empty(layout.Edges[0].BendPoints);
            // No control point above the destination: the unwanted hump is gone.
            Assert.Equal("M 100.0,200.0 C 325.0,200.0 175.0,100.0 400.0,100.0",
                DiagramEdgePath.Build(layout.Edges[0]));
        }
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public void ObstacleInsideEndpointBoundsOnlyPreservesHumpWhenItTouchesCurve(bool external, bool touchesCurve)
    {
        var layout = new DiagramLayout
        {
            Edges = [new() {
                SourceJobId = 1, TargetJobId = 2,
                SourceX = 100, SourceY = 200, TargetX = 400, TargetY = 100,
                BendPoints = [(150, 20), (250, 20)]
            }]
        };
        // The curve passes through (250,150), but clears the other rectangle
        // even though both obstacles lie inside the overall endpoint bounds.
        double x = touchesCurve ? 249.9 : 200;
        double y = touchesCurve ? 149.9 : 105;
        double size = touchesCurve ? 0.2 : 20;
        if (external)
            layout.ExternalConnections.Add(new() { X = x, Y = y, Width = size, Height = size });
        else
            layout.Nodes.Add(new() { ItemId = 3, X = x, Y = y, Width = size, Height = size });

        DiagramLayoutComputer.SimplifyUnobstructedEdges(layout);

        Assert.Equal(touchesCurve ? 2 : 0, layout.Edges[0].BendPoints.Count);
    }

    [Fact]
    public void OrdinaryDependencyRetainsItsBezierCurve()
    {
        var path = DiagramEdgePath.Build(new DiagramLayoutEdge
        {
            SourceX = 100, SourceY = 200, TargetX = 400, TargetY = 100
        });
        Assert.Equal("M 100.0,200.0 C 325.0,200.0 175.0,100.0 400.0,100.0", path);
    }
}
