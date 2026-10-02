$(document).ready(function () {
    marqueeLatestNews();
    page_click();
});

function marqueeLatestNews() {
    const marquee = document.getElementById('marqueeLatestNews');
    if (marquee) {
        marquee.addEventListener('mouseover', function () {
            marquee.stop();
        });

        marquee.addEventListener('mouseout', function () {
            marquee.start();
        });
    }
}


function page_click() {
    $.ajax({
        method: 'GET',
        url: $('#hdfBaseUrl').val() + 'Home/LatestNewsFetch',
        data: {}
    }).done(function (data) {
        $('#ulLatestNews').empty();
        $.each(data["UL"], function (index, item) {
            var li = $('<li></li>');
            var a = $('<a></a>')
                .attr('href', item['UploadPath'])
                .attr('target', '_blank')
                .attr('rel', 'noopener noreferrer');

            var icon = $('<i></i>')
                .addClass('fa fa-arrow-circle-right')
                .attr('aria-hidden', 'true');

            a.append(icon).append(' ' + item['Details']);
            li.append(a);
            $('#ulLatestNews').append(li);
        });
    }).fail(function () {
        swal("", "Something went wrong from server side.", "error");
    });

    //Visit Fetch on Home page
    $.ajax({
        method: 'GET',
        url: $('#hdfBaseUrl').val() + 'Home/VisitFetch',
        data: {}
    }).done(function (data) {
        $('#ulVisit').empty();

        if (data["UL"] && data["UL"].length > 0) {
            $.each(data["UL"], function (index, item) {
                const li = $('<li></li>');
                const icon = $('<i></i>')
                    .addClass('fa fa-arrow-circle-right')
                    .attr('aria-hidden', 'true');

                li.append(icon).append(' ' + (item['institutename']));
                $('#ulVisit').append(li);
            });
        } else {
            $('#ulVisit').append('<li>No visits found.</li>');
        }
    }).fail(function () {
        swal("", "Something went wrong from server side.", "error");
    });
    //Image Gallery Fetch on Home page
    $.ajax({
        method: 'GET',
        url: $('#hdfBaseUrl').val() + 'Home/ImageGallery',
        data: {}
    }).done(function (data) {
        $('#divImageGallery').empty();

        if (data["UL"] && data["UL"].length > 0) {
            $.each(data["UL"], function (index, item) {
                var colDiv = $('<div></div>').addClass('col-md-6 col-sm-6 col-xs-12');

                var a = $('<a></a>')
                    .attr('href', `${$('#hdfBaseUrl').val()}gallery?Id=${item['Id']}&Title=${encodeURIComponent(item['Imagegalarytitle'])}`);

                var img = $('<img>')
                    .attr('src', item['imagepath'])
                    .addClass('img-responsive');

                var h5 = $('<h5></h5>').text(item['Imagegalarytitle']);

                a.append(img).append(h5);
                colDiv.append(a);
                $('#divImageGallery').append(colDiv);
            });
        } else {
            $('#divImageGallery').append('<li>No visits found.</li>');
        }
    }).fail(function () {
        swal("", "Something went wrong from server side.", "error");
    });

}