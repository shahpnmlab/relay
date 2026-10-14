using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Rendering;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Refund.Components.Jobs.ExpandedView;

namespace Refund.Tests.Components;

public sealed class ExpandedViewLoadingTests
{
    [Fact]
    public async Task LoadingStateRendersBeforeDataIsReadyAndClearsAfterwards()
    {
        var services = new ServiceCollection().AddLogging();
        await using var provider = services.BuildServiceProvider();
        await using var renderer = new HtmlRenderer(provider, provider.GetRequiredService<ILoggerFactory>());
        var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        await renderer.Dispatcher.InvokeAsync(async () =>
        {
            var root = renderer.BeginRenderingComponent<SlowView>(ParameterView.FromDictionary(
                new Dictionary<string, object?> { [nameof(SlowView.Ready)] = ready.Task }));

            Assert.Contains("Loading job view", root.ToHtmlString());
            Assert.DoesNotContain("Dataset loaded", root.ToHtmlString());

            ready.SetResult();
            await root.QuiescenceTask;

            Assert.DoesNotContain("Loading job view", root.ToHtmlString());
            Assert.Contains("Dataset loaded", root.ToHtmlString());
        });
    }

    [Fact]
    public async Task LoadingStateClearsWhenInitializationFails()
    {
        var view = new FailingView();
        await Assert.ThrowsAsync<IOException>(view.InitializeAsync);
        Assert.False(view.Loading);
    }

    public sealed class SlowView : LoadingExpandedViewBase
    {
        [Parameter] public Task Ready { get; set; } = Task.CompletedTask;
        protected override Task InitializeViewAsync() => Ready;
        protected override void BuildRenderTree(RenderTreeBuilder builder) =>
            builder.AddContent(0, IsInitializing ? "Loading job view" : "Dataset loaded");
    }

    private sealed class FailingView : LoadingExpandedViewBase
    {
        public bool Loading => IsInitializing;
        public Task InitializeAsync() => OnInitializedAsync();
        protected override Task InitializeViewAsync() => throw new IOException("Unavailable dataset");
    }
}
