using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Refund.Components.Jobs;
using Refund.Components.SingleAxisScatter;
using Refund.Services;
using Refund.Utils;

namespace Refund.Tests.Components;

public class FsMiniItemTests
{
    [Fact]
    public async Task SelectedMetadataSurvivesClearingTheScatterHighlight()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<FileService>();
        services.AddSingleton<ScatterHighlightService>();
        await using var provider = services.BuildServiceProvider();
        await using var renderer = new HtmlRenderer(provider, provider.GetRequiredService<ILoggerFactory>());
        var highlights = provider.GetRequiredService<ScatterHighlightService>();
        await renderer.Dispatcher.InvokeAsync(async () =>
        {
            var selected = new WarpTools.MiniJsonFsItem { Path = "selected.mrc", Defocus = 1.234, Phase = .25 };
            var root = await renderer.RenderComponentAsync<FsMiniItem>(ParameterView.FromDictionary(
                new Dictionary<string, object?> { [nameof(FsMiniItem.SelectedItem)] = selected }));
            Assert.Contains("selected.mrc", root.ToHtmlString());
            Assert.Contains("Defocus:", root.ToHtmlString());
            Assert.Contains("Phase shift:", root.ToHtmlString());

            await highlights.SetHighlight(this, 1, new ScatterPoint { Metadata = new WarpTools.MiniJsonFsItem { Path = "hovered.mrc" } });
            Assert.Contains("hovered.mrc", root.ToHtmlString());
            await highlights.SetHighlight(this, -1, null);
            Assert.Contains("selected.mrc", root.ToHtmlString());
            Assert.DoesNotContain("hovered.mrc", root.ToHtmlString());
        });
    }
}
