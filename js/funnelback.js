function FunnelbackSearch($, ko, settings){

    //1.   Variables and Methods
    var self = this;
    var viewModel = null;
    var opts = $.extend({}, FunnelbackSearch.DefaultSettings, settings);

    //2.  KO Objects
    function XFacetModel(_title)
    {
        var self = this;

        self.title = ko.observable(_title);
        self.valueList = ko.observableArray();
        self.selectedValue = null;

    }

    function XFacetValueModel(_category, _label, _count, _queryStringParam)
    {
        var self = this;

        self.category = ko.observable(_category);
        self.label = ko.observable(_label);
        self.count = ko.observable(_count);
        self.queryStringParam = ko.observable(_queryStringParam);

        self.display = ko.computed(function(){
            return this.label() + ' (' + this.count() + ')';
        }, this);

        self.displaySelected = ko.computed(function(){
            return this.category() + ' (' + this.label() + ')';
        }, this);

    }

    function XContextModel(_title)
    {
        var self = this;

        self.title = ko.observable(_title);
        self.valueList = ko.observableArray();

    }

    function XContextValueModel(_label, _count, _query, _href)
    {
        var self = this;

        self.label = ko.observable(_label);
        self.count = ko.observable(_count);
        self.query = ko.observable(_query);
        self.href = ko.observable(_href);

        self.display = ko.computed(function(){
            return this.label() + ' (' + this.count() + ')';
        }, this);

    }

    function XResultSummaryModel(_totalMatching, _currStart, _currEnd, _query)
    {
        var self = this;

        self.totalMatching = ko.observable(_totalMatching);
        self.currStart = ko.observable(_currStart);
        self.currEnd = ko.observable(_currEnd);
        self.query = ko.observable(_query);

    }

    function XResultModel(_title, _summary, _url)
    {
        var self = this;

        self.title = ko.observable(_title);
        self.summary = ko.observable(_summary);
        self.url = ko.observable(_url);

    }

    function XBestBetModel(_title, _description, _url)
    {
        var self = this;

        self.title = ko.observable(_title);
        self.summary = ko.observable(_description);
        self.url = ko.observable(_url);
    }

    function XPageModel(_pageNo, _pageSize, _currentPageFlag)
    {
        var self = this;

        self.pageNo =  _pageNo;
        self.pageSize = _pageSize;
        self.startRecord = (self.pageNo-1)*self.pageSize + 1;
        self.currentPageFlag = _currentPageFlag;

        self.pageStatus =  ko.computed(function() {
            return self.currentPageFlag  ? "currentPage" : "otherPage";
        }, this);

    }

    //3.  View Model
    function XSearchViewModel()
    {
        var self = this;

        self.searchTerm = ko.observable('the');
        self.selectedFacetList = ko.observableArray();
        self.searchCollection = opts.SearchCollection;


        self.facetList = ko.observableArray();
        self.resultSummary = new XResultSummaryModel();
        self.resultList = ko.observableArray();
        self.contextList = ko.observableArray();
        self.bestBetList = ko.observableArray();
        self.pageList = ko.observableArray();
        self.showPagePrevious = ko.observable(false);
        self.showPageNext = ko.observable(false);

        self.searchSummary = ko.computed(function(){

            if(this.resultSummary.currStart()==null)
            {
                return "";
            }

            if(this.resultSummary.totalMatching()==0)
            {
                return 'No results found.  Try again!'
            }else{
                return this.resultSummary.currStart() + '-' + this.resultSummary.currEnd() + ' of ' +  this.resultSummary.totalMatching() + ' search results for <b>' + this.searchTerm() + '</b>';
            }

        }, this);

        self.clear = function()
        {
            self.facetList.removeAll();
            self.resultList.removeAll();
            self.contextList.removeAll();
            self.bestBetList.removeAll();
            self.pageList.removeAll();
        }

        self.processPageList = function()
        {
            var noPagesDisplay = opts.noPagesDisplay;
            var noPagesDisplayBeforeCurrent = opts.noPagesDisplayBeforeCurrent;
            var pageSize = opts.pageSize;

            var currStart = self.resultSummary.currStart();
            var currEnd = self.resultSummary.currEnd();
            var totalMatching = self.resultSummary.totalMatching();

            var currentPage = (currStart-1)/pageSize + 1;
            var totalPages = Math.floor(totalMatching/pageSize);
            if(totalMatching%pageSize!=0)
            {
                totalPages = totalPages + 1;
            }

            for(var i=4; i>0; i--)
            {
                if(currentPage-i>0){
                    self.pageList.push(new XPageModel(currentPage-i, pageSize, false));
                }
            }

            var noPagesDisplayAfterCurrent = noPagesDisplay - 1 - self.pageList().length;

            self.pageList.push(new XPageModel(currentPage, pageSize, true));

            for(var i=1; i<=noPagesDisplayAfterCurrent; i++)
            {
                if(currentPage+i <= totalPages){
                    self.pageList.push(new XPageModel(currentPage+i, pageSize, false));
                }
            }

            if(currentPage>1)
            {
                self.showPagePrevious(true);
            }else{
                self.showPagePrevious(false);
            }
            if(currentPage<totalPages)
            {
                self.showPageNext(true);
            }else{
                self.showPageNext(false);
            }

        }

        self.goToPage = function(page)
        {
            if(page.currentPageFlag)
            {
                return;
            }
            self.search(page.startRecord);
        }
        self.goToPagePrevious = function()
        {
            var pageSize = opts.pageSize;
            var currStart = self.resultSummary.currStart();

            self.search(currStart - opts.pageSize );
        }
        self.goToPageNext = function()
        {
            var pageSize = opts.pageSize;
            var currStart = self.resultSummary.currStart();

            self.search(currStart + opts.pageSize );
        }

        self.unselectFacet = function(facet)
        {
            self.selectedFacetList.remove(facet);
            self.startSearch();
        }

        self.selectFacet = function(facet)
        {
            self.selectedFacetList.push(facet);
            self.startSearch();
        }

        self.selectContext = function(context)
        {
            self.searchTerm(context.query());
            self.startSearch();
        }

        self.addFacet = function(fbFacet)
        {
            if(fbFacet.categories.length==0)
            {
                return;
            }
            var selectedItem = ko.utils.arrayFilter(self.selectedFacetList(), function(item){
                if(item.category() == fbFacet.name){
                    return true;
                }
                return false;
            });
            if(selectedItem.length!=0){
                return;
            }

            var facet = new XFacetModel(fbFacet.name);

            $.each(fbFacet.categories[0].values, function(index, value){
                facet.valueList.push(new XFacetValueModel(fbFacet.name, value.label, value.count, value.queryStringParam));
            });

            self.facetList.push(facet);
        }

        self.addContext = function(fbContext)
        {
            var context = new XContextModel(fbContext.name);

            $.each(fbContext.clusters, function(index, value){
                context.valueList.push(new XContextValueModel(value.label, value.count, value.query, value.href));
            });

            self.contextList.push(context);

        }

        self.startSearch = function()
        {
            self.search(1);
        }

        self.search = function(startRecord){

            var searchUrl = opts.searchUrl + '?collection=' + opts.searchCollection;
            if(self.searchTerm()!='')
            {
                searchUrl = searchUrl + '&query=' + self.searchTerm();
            }
            if(self.selectedFacetList().length>0)
            {
                $.each(self.selectedFacetList(), function(index, data){

                    searchUrl = searchUrl + '&' + data.queryStringParam();

                });
            }
            if(startRecord!=null && startRecord!=1)
            {
                searchUrl = searchUrl + '&start_rank=' + startRecord;
            }


            $.ajax({
                type: "GET",
                url: searchUrl,
                contentType: "application/json",
                dataType: 'jsonp'
            }).done(function(data){

                self.processSearch(data);

             })

        };

        self.processSearch = function(data)
        {
            self.clear();

            var totalResults =  data.response.resultPacket.resultsSummary.totalMatching;
            self.resultSummary.totalMatching(totalResults);

            if(totalResults>0){

                $.each(data.response.facets, function(index, fbFacet){

                    self.addFacet(fbFacet);

                });
                $.each(data.response.resultPacket.results, function(index, fbResult){

                    var result = new XResultModel(fbResult.title, fbResult.summary, fbResult.clickTrackingUrl);
                    self.resultList.push(result);

                });
                if(data.response.resultPacket.contextualNavigation!=null){
                    $.each(data.response.resultPacket.contextualNavigation.categories, function(index, fbContext){

                        self.addContext(fbContext);

                    });
                }
                $.each(data.response.resultPacket.bestBets, function(index, fbBestBet){

                    var bestBet = new XBestBetModel(fbBestBet.title, fbBestBet.description, fbBestBet.clickTrackingUrl);
                    self.bestBetList.push(bestBet);

                });

                var resultsSummary = data.response.resultPacket.resultsSummary;
                self.resultSummary.currStart(resultsSummary.currStart);
                self.resultSummary.currEnd(resultsSummary.currEnd);
                self.resultSummary.query(data.response.resultPacket.query);

                self.processPageList();

            }

        }
    }



    //4. Init
    self.init = function(element){

        self.viewModel = new XSearchViewModel();
        var selectedElement = document.getElementById($(element).attr("id"));

        ko.applyBindings(self.viewModel, selectedElement);

    };


}

FunnelbackSearch.DefaultSettings = {
    searchCollection: "xtremax-nea-site",
    pageSize: 10,
    noPagesDisplay : 10,
    noPagesDisplayBeforeCurrent : 4,
    //searchUrl: "http://fb.localdev.info/s/search.json"
    searchUrl: "http://search-au.funnelback.com/s/search.json"
};


