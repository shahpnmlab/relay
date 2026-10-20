using System.Text.Json;
using Microsoft.AspNetCore.Components;
using Microsoft.FluentUI.AspNetCore.Components;
using Refund.Components.SingleAxisScatter;
using Refund.Components.ThumbnailPanel;
using Refund.DataModel.ReadOnly;
using Refund.Services;
using Refund.Utils;
using Color = System.Drawing.Color;

namespace Refund.Jobs.Fs.MotionCtf.MotionAndCTF2D;

public partial class MotionAndCTF2DExpandedView : IAsyncDisposable
{
    [Inject] private ExpandedJobViewService ExpandedViewService { get; set; }
    [Inject] private ScatterHighlightService HighlightService { get; set; }

    private ThumbnailPanel _thumbnailPanel;
    private FluentTabs _tabs;
    
    private ReadOnlyMotionAndCTF2D _job;
    private List<WarpTools.MiniJsonFsItem> _processedItems;
    private List<ThumbnailData> _allThumbnails = new();
    private ThumbnailData _selectedThumbnail;
    private string _selectedName;
    private WarpTools.MiniJsonFsItem? _selectedItem;
    
    private List<ScatterPoint> _pointsDefocus = new();
    private List<ScatterPoint> _pointsCtfRes = new();
    private List<ScatterPoint> _pointsCtfThickness = new();
    private List<ScatterPoint> _pointsMotion = new();

    private string _movieFilePath => _selectedName != null 
        ? Path.Combine(_job.DirectoryPath, $"{Path.GetFileNameWithoutExtension(_selectedName)}.xml")
        : string.Empty;

    protected override async Task InitializeViewAsync()
    {
        ExpandedViewService.OnJobChanged += HandleJobChanged;
        ExpandedViewService.OnJobUpdated += HandleJobUpdated;
        await HandleJobChanged(ExpandedViewService.CurrentJob);
    }

    private async Task HandleJobChanged(ReadOnlyJob job)
    {
        if (job is ReadOnlyMotionAndCTF2D motionAndCtf2D)
        {
            _job = motionAndCtf2D;
            _selectedThumbnail = null;
            _selectedName = null;
            _selectedItem = null;
            await LoadData();
        }
        else
        {
            _job = null;
        }
        
        await InvokeAsync(StateHasChanged);
    }

    private async Task HandleJobUpdated()
    {
        await LoadData();
        await InvokeAsync(StateHasChanged);
    }

    private async Task SelectedThumbnailChanged(ThumbnailData data)
    {
        if (!_allThumbnails.Contains(data))
            return;

        _selectedThumbnail = data;
        _selectedItem = _processedItems[_allThumbnails.IndexOf(data)];
        _selectedName = _selectedItem.Path;
        await _tabs.SelectTabAsync("tab-details");
        StateHasChanged();
    }

    private async Task HandlePointClicked(ScatterPoint point)
    {
        var metadata = point.Metadata as WarpTools.MiniJsonFsItem;
        
        if (!_processedItems.Contains(metadata))
            return;
        
        int index = _processedItems.IndexOf(metadata);
        _selectedThumbnail = _allThumbnails[index];
        _selectedItem = _processedItems[index];
        _selectedName = _selectedItem.Path;

        await HighlightService.SetHighlight(this, -1, null);
        await _tabs.SelectTabAsync("tab-details");
        await _thumbnailPanel.SetSelectedThumbnailAsync(_selectedThumbnail);
    }

    private async Task LoadData()
    {
        if (_job == null)
            return;

        try
        {
            var processedItemsJson = await File.ReadAllTextAsync(_job.ResProcessedItemsJson);
            _processedItems = JsonSerializer.Deserialize<List<WarpTools.MiniJsonFsItem>>(processedItemsJson);
            _selectedItem = _processedItems?.FirstOrDefault(item => item.Path == _selectedName);

            var thumbnails = new List<ThumbnailData>(_allThumbnails.Capacity);
            var pointsDefocus = new List<ScatterPoint>(_pointsDefocus.Capacity);
            var pointsCtfRes = new List<ScatterPoint>(_pointsCtfRes.Capacity);
            var pointsMotion = new List<ScatterPoint>(_pointsMotion.Capacity);
            var pointsCtfThickness = new List<ScatterPoint>(_pointsCtfThickness.Capacity);
            
            for (var i = 0; i < _processedItems.Count; i++)
            {
                thumbnails.Add(new ThumbnailData
                {
                    Index = i,
                    ImagePath = _job.VisThumbnail(_processedItems[i].Path),
                    Status = ProcessingStatus.Processed
                });

                pointsDefocus.Add(new ScatterPoint
                {
                    Value = _processedItems[i].Defocus,
                    Color = Color.YellowGreen,
                    Metadata = _processedItems[i]
                });
                
                pointsCtfRes.Add(new ScatterPoint
                {
                    Value = _processedItems[i].Resolution,
                    Color = Color.YellowGreen,
                    Metadata = _processedItems[i]
                });
                
                var item = _processedItems[i];
                if (item.CtfSpecimenThicknessAngstrom.HasValue)
                    pointsCtfThickness.Add(new ScatterPoint
                    {
                        Value = item.CtfSpecimenThicknessAngstrom,
                        Color = Color.YellowGreen,
                        Metadata = item
                    });

                pointsMotion.Add(new ScatterPoint
                {
                    Value = _processedItems[i].Motion,
                    Color = Color.YellowGreen,
                    Metadata = _processedItems[i]
                });
            }

            _allThumbnails = thumbnails;
            _pointsDefocus = pointsDefocus;
            _pointsCtfRes = pointsCtfRes;
            _pointsCtfThickness = pointsCtfThickness;
            _pointsMotion = pointsMotion;
        }
        catch { }
    }
    
    public async ValueTask DisposeAsync()
    {
        ExpandedViewService.OnJobChanged -= HandleJobChanged;
        ExpandedViewService.OnJobUpdated -= HandleJobUpdated;
    }
}