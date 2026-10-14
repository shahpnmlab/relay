using System.Text.Json;
using Refund.Utils;
using Warp;

namespace Refund.Tests.Utils;

public sealed class MiniJsonThicknessTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "relay-mini-json-" + Guid.NewGuid().ToString("N"));

    public MiniJsonThicknessTests() => Directory.CreateDirectory(_directory);

    [Theory]
    [InlineData(1456.75)]
    [InlineData(0)]
    public void MovieSummaryCarriesThicknessWithoutXml(double thickness)
    {
        var movie = new Movie(Path.Combine(_directory, "movie.mrc"))
        {
            CTFSpecimenThicknessAngstrom = (decimal)thickness
        };

        var json = movie.ToMiniJson().ToJsonString();
        var summary = JsonSerializer.Deserialize<WarpTools.MiniJsonFsItem>(json)!;

        Assert.Equal(thickness > 0 ? thickness : (double?)null, summary.CtfSpecimenThicknessAngstrom);
        Assert.Empty(Directory.GetFiles(_directory, "*.xml"));
    }

    [Theory]
    [InlineData(2468.5)]
    [InlineData(0)]
    public void TiltSeriesSummaryCarriesThicknessWithoutXml(double thickness)
    {
        string path = Path.Combine(_directory, "series.tomostar");
        File.WriteAllText(path, "data_\nloop_\n_wrpMovieName #1\n_wrpAngleTilt #2\n_wrpDose #3\na.mrc -30 1\nb.mrc 30 2\n");
        var series = new TiltSeries(path)
        {
            CTF = new CTF(),
            OptionsCTF = new ProcessingOptionsMovieCTF(),
            CTFSpecimenThicknessAngstrom = (decimal)thickness
        };

        var json = series.ToMiniJson().ToJsonString();
        var summary = JsonSerializer.Deserialize<WarpTools.MiniJsonTsItem>(json)!;

        Assert.Equal(thickness > 0 ? thickness : (double?)null, summary.CtfSpecimenThicknessAngstrom);
        Assert.Empty(Directory.GetFiles(_directory, "*.xml"));
    }

    [Fact]
    public void LegacySummariesHaveNoThicknessEstimate()
    {
        const string json = "{\"Path\":\"item\"}";
        Assert.Null(JsonSerializer.Deserialize<WarpTools.MiniJsonFsItem>(json)!.CtfSpecimenThicknessAngstrom);
        Assert.Null(JsonSerializer.Deserialize<WarpTools.MiniJsonTsItem>(json)!.CtfSpecimenThicknessAngstrom);
    }

    public void Dispose() => Directory.Delete(_directory, true);
}
