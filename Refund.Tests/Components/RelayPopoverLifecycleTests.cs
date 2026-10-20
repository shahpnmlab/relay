using System.Reflection;
using Microsoft.JSInterop;
using Refund.Components;

namespace Refund.Tests.Components;

public sealed class RelayPopoverLifecycleTests
{
    [Fact]
    public async Task ParentRendersDuringSlowModuleImportDoNotStartAnotherInitialization()
    {
        var runtime = new DelayedRuntime();
        var popover = new TestPopover { AnchorId = "anchor" };
        typeof(RelayPopover).GetProperty("JS", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)!
            .SetValue(popover, runtime);

        var initialRender = popover.RenderedAsync(true);
        Assert.False(initialRender.IsCompleted);
        await popover.RenderedAsync(false);
        await popover.RenderedAsync(false);
        Assert.Equal(1, runtime.Imports);

        var module = new FakeModule();
        runtime.Ready.SetResult(module);
        await initialRender;
        Assert.Equal(1, module.Initializations);
        await popover.DisposeAsync();
    }

    private sealed class TestPopover : RelayPopover
    {
        public Task RenderedAsync(bool firstRender) => OnAfterRenderAsync(firstRender);
    }

    private sealed class DelayedRuntime : IJSRuntime
    {
        public int Imports { get; private set; }
        public TaskCompletionSource<IJSObjectReference> Ready { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public ValueTask<TValue> InvokeAsync<TValue>(string identifier, object?[]? args)
        {
            Assert.Equal("import", identifier);
            Imports++;
            return new ValueTask<TValue>(CompleteAsync<TValue>());
        }
        private async Task<TValue> CompleteAsync<TValue>() => (TValue)(object)await Ready.Task;
        public ValueTask<TValue> InvokeAsync<TValue>(string identifier, CancellationToken cancellationToken, object?[]? args) =>
            InvokeAsync<TValue>(identifier, args);
    }

    private sealed class FakeModule : IJSObjectReference
    {
        public int Initializations { get; private set; }
        public ValueTask<TValue> InvokeAsync<TValue>(string identifier, object?[]? args)
        {
            if (identifier != "initialize") return ValueTask.FromResult(default(TValue)!);
            Initializations++;
            return ValueTask.FromResult((TValue)(object)this);
        }
        public ValueTask<TValue> InvokeAsync<TValue>(string identifier, CancellationToken cancellationToken, object?[]? args) =>
            InvokeAsync<TValue>(identifier, args);
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
