using Microsoft.AspNetCore.Components;

namespace Refund.Components.Jobs.ExpandedView;

/// <summary>
/// Gives expanded views a renderable loading state before their initial data reads.
/// </summary>
public abstract class LoadingExpandedViewBase : ComponentBase
{
    protected bool IsInitializing { get; private set; } = true;

    protected sealed override async Task OnInitializedAsync()
    {
        // Even views with synchronous file reads must render before starting work.
        await Task.Yield();
        try
        {
            await InitializeViewAsync();
        }
        finally
        {
            IsInitializing = false;
        }
    }

    protected abstract Task InitializeViewAsync();
}
