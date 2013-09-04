var googleSearch = 'https://www.googleapis.com/customsearch/v1?cx=011393088886668459485:o31utriy8s0&q=xtremax&key=AIzaSyAfb8tGKn6cGtWaAt8cRh8PTbk7bu5meiA'

function GoogleSearch($, ko, settings){

    //1.   Variables and Methods
    var self = this;
    var viewModel = null;
    var opts = $.extend({}, GoogleSearch.DefaultSettings, settings);

    //2.  KO Objects
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

        self.startSearch = function()
        {
            self.search(1);
        }

        self.search = function(startRecord){

            var searchUrl = opts.searchUrl + '?cx=' + opts.cx + '&key=' + opts.key + '&filter=' + opts.filter;
            if(self.searchTerm()!='')
            {
                searchUrl = searchUrl + '&q=' + self.searchTerm();
            }

            if(startRecord!=null && startRecord!=1)
            {
                searchUrl = searchUrl + '&start=' + startRecord;
            }


            $.ajax({
                type: "GET",
                url: searchUrl
            }).done(function(data){

                    self.clear();

                    var totalResults =  data.queries.request[0].totalResults;
                    self.resultSummary.totalMatching(totalResults);

                    if(totalResults>0){

                        $.each(data.items, function(index, gResult){

                            var result = new XResultModel(gResult.title, gResult.htmlSnippet, gResult.link);
                            self.resultList.push(result);

                        });


                        var resultStats = data.queries.request[0];
                        self.resultSummary.currStart(resultStats.startIndex);
                        self.resultSummary.currEnd(resultStats.startIndex+9);
                        self.resultSummary.query(resultStats.searchTerms);

                        self.processPageList();

                    }

                    console.log("AJAX Search is triggered");

                })
        };
    }

    //4. Init
    self.init = function(element){

        self.viewModel = new XSearchViewModel();
        var selectedElement = document.getElementById($(element).attr("id"));

        ko.applyBindings(self.viewModel, selectedElement);

    };


}

GoogleSearch.DefaultSettings = {
    cx: "011393088886668459485:o31utriy8s0&",
    key: 'AIzaSyAfb8tGKn6cGtWaAt8cRh8PTbk7bu5meiA',
    filter : 1, //1 to turn on the duplicate content filter
    pageSize: 10,
    noPagesDisplay : 10,
    noPagesDisplayBeforeCurrent : 4,
    searchUrl: "https://www.googleapis.com/customsearch/v1"
    //searchUrl: "http://search-au.funnelback.com/s/search.json?query=dengue&collection=xtremax-nea-site"
};


'https://www.googleapis.com/customsearch/v1?cx=011393088886668459485:o31utriy8s0&q=xtremax&key=AIzaSyAfb8tGKn6cGtWaAt8cRh8PTbk7bu5meiA'

